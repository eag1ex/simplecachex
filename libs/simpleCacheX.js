/**
 * @SimpleCacheX
 * * Version : 1.0.0
 * * License: `CC BY`
 * * Build by `EagleX Technologies.`
 * * A Local to file data store, for testing purposes only
 * * In live environment this is not save or desirable, you may want to use `Redis` or your database for holding temp data information
 * * files are stored as per setting in `./cache` dir
 * * every file is appended with {fileName}_cache_{timestamp}.json
 */

/**
 * example usage

 let simpleCache = require('./simpleCacheX')()
    sc = new simpleCache(0.2, true)
    sc.write('test_file', { a: 0, b: 0, c: 9 })
    let l = sc.load('test_file')
    let u= sc.update('test_file', { d: 5, e: 5, a: 10 })
    console.log(u)

    let all = sc.getAll() // get all avail cache

 */

module.exports = () => {

    const fs = require('fs')
    const { merge, isString, isObject, isArray, isEmpty, isNumber } = require('lodash')
    const path = require('path')
    const moment = require('moment')
    const { log, warn, onerror } = require('x-utils-es/umd')

    class SimpleCacheX {
        constructor(expire, debug = false) {
            this.debug = debug
            this._expire = 1 // default, or in hours >  (1, 3, 5, 0.5)
            this.expire = expire
            this.expireIn = null
            this.removeExpired()
        }

        get cacheDir() {
            return `../cache`
        }
        get expire() {
            return this._expire
        }

        set expire(v) {
            let newTime
            if (isNaN(Number(v))) {
                let defaultTime = 1 // 1 hour
                let forwardTime = (defaultTime * 60 * 60 * 1000)
                newTime = new Date(Date.now() + forwardTime).getTime()
                if (this.debug) log('provided wrong expiry format, defaulting:1hr')
            } else {
                // NOTE using -1 as never expire

                if (Number(v) === -1) {
                    v = 10000000// setting large ininite number to never extire
                    if (this.debug) log('expire=-1 setting to never expire')
                }

                let forwardTime = (Number(v) * 60 * 60 * 1000)
                newTime = new Date(Date.now() + forwardTime).getTime()

            }

            let valid = moment(newTime).isValid()
            if (!valid) throw ('specified {expire} time is invalid')

            let expireIn = moment(newTime).format('MMMM Do YYYY, h:mm:ss a')
            this.expireIn = { date: newTime, nice: expireIn }
            if (this.debug) log({ message: 'cache will expire at', expireIn })

            this._expire = newTime
        }

        /**
         * @removeExpired
         * * removes expired files
         */
        removeExpired() {
            let dirPath = path.join(__dirname, `${this.cacheDir}`)
            let dir = fs.readdirSync(dirPath)

            let removeIt = (file) => {
                let fileFilePath = path.join(dirPath, file)
                try {
                    fs.unlinkSync(fileFilePath)
                } catch (err) {
                    // handle the error
                }
            }

            dir.forEach((file, inx) => {
                let timestamp = file.split('_')
                timestamp = timestamp[timestamp.length - 1]
                timestamp = timestamp.replace('.json', '')
                timestamp = Number(timestamp)

                if (isNumber(timestamp)) {
                    let curTime = new Date().getTime()
                    if (curTime >= timestamp) {
                        removeIt(file)
                    }
                }
            })
        }

        /**
         * @getAll
         * retrieve all cache from current non-expired period
         */
        getAll() {
            let allCache = {}
            let dirPath = path.join(__dirname, `${this.cacheDir}`)
            let dir = fs.readdirSync(dirPath)

            dir.forEach((file, inx) => {
                let timestamp = file.split('_')
                timestamp = timestamp[timestamp.length - 1]
                timestamp = timestamp.replace('.json', '')
                timestamp = Number(timestamp)

                if (isNumber(timestamp)) {
                    let curTime = new Date().getTime()
                    if (curTime < timestamp) {
                        let fileName = file.split('_')[0]
                        let d = this.load(fileName)
                        allCache[fileName] = d
                    }
                }
            })
            return allCache
        }

        errHandler(fileName, _where) {
            if (!fileName) throw ('fileName must be set')
            if (!isString(fileName)) {
                if (this.debug) onerror(`${_where} fileName must be a string`)
                return true
            }
            if (fileName.indexOf('.json') !== -1) {
                if (this.debug) onerror(`${_where} must provide fileName without .json extention`)
                return true
            }
            if (fileName.length < 3) {
                if (this.debug) onerror(`${_where} fileName must be longer then 3`)
                return true
            }

            if (fileName.indexOf('_') !== -1) {
                if (this.debug) onerror(`${_where} fileName invalid format, cannot include '_'`)
                return true
            }

            return false
        }

        /**
         * @write
         * * write file to cache dir
         * * must provide {fileName} and {data}
         * * file written in format: {fileName}_cache_{timestamp}.json
         * return boolean
         */
        write(fileName, data) {
            if (this.errHandler(fileName, 'write')) return false
            if (isEmpty(data)) {
                if (this.debug) log('write data must be set')
                return false
            }
            const newFile = path.join(__dirname, `${this.cacheDir}/${fileName}_cache_${this.expire}.json`)

            try {
                fs.writeFileSync(newFile, JSON.stringify(data))
                return true
            } catch (err) {
                log(err, true)
                return false
            }
        }

        /**
         * @update
         * update with last cached file, 2 items must be eaqul type, array or object
         * * returns updated data or false
         */
        update(fileName, newData) {
            if (this.errHandler(fileName, 'update')) return false
            if (!newData) {
                if (this.debug) onerror('[update] newData not set')
                return
            }
            let sourceData = this.load(fileName)
            if (isEmpty(sourceData)) return false

            if (isObject(sourceData) && isObject(newData)) {
                let merged = merge(sourceData, newData) || {}
                let done = this.write(fileName, merged)
                if (done) return merged
            }
            if (isArray(sourceData) && isArray(newData)) {
                let merged = merge(newData, sourceData) || []
                let done = this.write(fileName, merged)
                if (done) return merged
            } else {
                throw (' you can only update/merge data with last cache that is of eaqul type!')
            }
            return true
        }

        /**
         * @findMatch
         * find latest match by date
         * return fileName, excluding file extension
         */
        findMatch(fileName) {
            if (this.errHandler(fileName, 'scanFind')) return ''

            let dir = fs.readdirSync(path.join(__dirname, `${this.cacheDir}`)) || []
            let found = dir.reduce((n, el) => {
                if (el.indexOf(fileName) !== -1) {
                    let ell = el.split('.json')[0]
                    let timestamp = ell.split('_')
                    timestamp = timestamp[timestamp.length - 1]
                    if (timestamp) n.push([ell, Number(timestamp)])
                }
                return n
            }, []).sort((a, b) => b[1] - a[1]) // sort by latest

            if (found[0]) {
                let format = found[0][0]
                return format
            } else {
                if (this.debug) onerror(`${fileName} not found in: ${this.cacheDir}`)
                return ''
            }
        }

        /**
         * @load
         * load available data that hasn't expired
         * * return data
         */
        load(fileName) {
            if (this.errHandler(fileName, 'load')) return false

            try {
                let foundFile = this.findMatch(fileName)
                if (!foundFile) {
                    if (this.debug) log(`${fileName} file not found, or expired`)
                    return null
                }
                let d = require(`${this.cacheDir}/${foundFile}.json`) || null
                return d || null
            } catch (err) {
                if (this.debug) onerror(`${fileName} file not found, or expired`)
                return null
            }
        }
    }
    return SimpleCacheX
}
