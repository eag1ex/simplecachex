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
        constructor(opts={}, debug = false) {
            this.debug = debug
           // this._expire = 1 // default, or in hours >  (1, 3, 5, 0.5)
           this._cacheDir = opts.cacheDir || null // or use default instead
            this.expire = opts.expire || 1
            this.expireIn = null
            this.autoDeleteLimit = Number(opts.autoDeleteLimit) || 0 // NOTE check file limit every time new file is being created, when enabled (number provided), when set method `fileLimit()` can no longer be used maualy, but controlled by this setting
            if((this.cacheDir||"").length<2) throw('provided wrong cacheDir')
            this.makeDir(this.cacheDir)
            this.removeExpired()
        }

        get cacheDir() {
            return this._cacheDir || path.join(__dirname, `../cache`)
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
         * - test if dir exists or make new one
        */
        makeDir(dirName) {     
            if (!fs.existsSync(dirName)) {        
                try {
                    fs.mkdirSync(dirName);
                    return true
                } catch (err) {
                    if(this.debug) onerror('[write]',err.toString())
                    return false
                }     
            }
            return true
        }

        /**
         * - keep desired file limit in your `cacheDir` path
         */
        fileLimit(limit = 0, override=null) {
            if(this.autoDeleteLimit>0 && !override) {
                if(this.debug) warn(`[fileLimit] cannot use this method directly when autoDeleteLimit>0`)
                return this
            }
            if (limit < 1) return this
            let dir = fs.readdirSync(this.cacheDir) || []
            let fileList = []
            dir.forEach((file, inx) => {
                let timestamp = this.fileTimeStamp(file)
                if (timestamp !== null) fileList.push(timestamp)
            })
            // sort latest first
            fileList.sort((a, b) => b - a)
            fileList.splice(0, limit)
            dir.forEach((file, inx) => {
                let timestamp = this.fileTimeStamp(file)
                if (fileList.indexOf(timestamp) !== -1) {
                    this.removeIt(file)
                    log(`removed by limit`, file)
                }
            })
            return this
        }

        /** 
         * - get file timestamp from file 
         * @returns timestamp
        */
        fileTimeStamp(file) {
            let timestamp = file.split('_')
            timestamp = timestamp[timestamp.length - 1]
            timestamp = timestamp.replace('.json', '')
            timestamp = Number(timestamp)
            return isNumber(timestamp) ? timestamp : null
        }

        removeIt(file) {
            let fileFilePath = path.join(this.cacheDir, file)
            try {
                fs.unlinkSync(fileFilePath)
                return true
            } catch (err) {
                if (this.debug) onerror(`[removeIt] file not removed`)
                // handle the error
                return false
            }
        }

        /**
         * @removeExpired
         * * removes expired files
         */
        async removeExpired() {
            // let dirPath = path.join(__dirname, `${this.cacheDir}`)
            try {
                let dir = fs.readdirSync(this.cacheDir) || []

                dir.forEach((file, inx) => {
                    let timestamp = this.fileTimeStamp(file)
                    if (timestamp !== null) {
                        let curTime = new Date().getTime()
                        if (curTime >= timestamp) {
                            this.removeIt(file)
                        }
                    }
                })
            } catch (err) {
                if (this.debug) onerror(`[removeExpired]`, err.toString())
            }

        }

        /**
         * @getAll
         * retrieve all cache from current non-expired period
         */
        getAll() {
            let allCache = {}
            //let dirPath = path.join(__dirname, `${this.cacheDir}`)
            try {
                let dir = fs.readdirSync(this.cacheDir) || []

                dir.forEach((file, inx) => {
                    let timestamp = this.fileTimeStamp(file)
                    if (timestamp !== null) {
                        let curTime = new Date().getTime()
                        if (curTime < timestamp) {
                            let fileName = file.split('_')[0]
                            let d = this.load(fileName)
                            allCache[fileName] = d
                        }
                    }
                })

                return allCache
            } catch (err) {
                if(this.debug) onerror(`[getAll]`,err.toString() )
                return null
            }

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
        write(fileName, data, _type=null) {
            if (this.errHandler(fileName, 'write')) return false
            if (isEmpty(data)) {
                if (this.debug) log('write data must be set')
                return false
            }

            // NOTE only delete files by limit when calling `write` method directly and  `autoDeleteLimit` is larger then 0
            if (!_type) this.fileLimit(this.autoDeleteLimit, true)

            const newFile = path.join(this.cacheDir, `${fileName}_cache_${this.expire}.json`)

            try {
                fs.writeFileSync(newFile, JSON.stringify(data))
                return true
            } catch (err) {
                onerror('[write]',err.toString())
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
                let done = this.write(fileName, merged,'update')
                if (done) return merged
            }
            if (isArray(sourceData) && isArray(newData)) {
                let merged = merge(newData, sourceData) || []
                let done = this.write(fileName, merged, type='update')
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

            let dir = fs.readdirSync(this.cacheDir) || []
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
