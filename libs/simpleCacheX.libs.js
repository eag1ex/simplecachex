
module.exports = () => {
    const fs = require('fs')
    const { isString, isNumber, uniqBy } = require('lodash')
    const path = require('path')
    const moment = require('moment')
    const { log, warn, onerror} = require('x-utils-es/umd')
    return class Libs {
        constructor(opts = {}, debug = false) {
            this.debug = debug
           
            // NOTE should be called in head of constructor
            this._presets(opts)
        }

        _presets(opts) {
            this.routeFile = null // helps us where to store our next file, especially when using `toSubDir()`
            this.d = null // temp data holder
            // this._expire = 1 // default, or in hours >  (1, 3, 5, 0.5)
            this.keepLast = opts.keepLast || false // allow for latest cache file to remain, and not expire
            this._cacheDir = opts.cacheDir || null // or use default instead
            this.expire = opts.expire || this.defaultTime.str
            this.smartUpdate = opts.smartUpdate || false // when calling write() and cacheName already exists, with smartUpdate set it will merge with existing data depending on data type
            if (!opts.expire) {
                if (this.debug) log(`opts.expire not set setting defaultTime: ${opts.expire}`)
            }
            this._expireIn = null
            this.autoDeleteLimit = Number(opts.autoDeleteLimit) || 0 // NOTE check file limit every time new file is being created, when enabled (number provided), then set method `fileLimit()` can no longer be used maualy, but controlled by this setting
            if ((this.cacheDir || "").length < 2) throw ('provided wrong cacheDir')

            if(this.makeDir(this.cacheDir)===null){
                throw('error makeDir')
            }
            
            this.removeExpired()
        }

        get expire() {
            return this._expire
        }

        set expire(v) {
            if (this._expire) return
            const newTime = this.setDate(v)
            let valid = moment(newTime).isValid()
            if (!valid) throw ('specified {expire} time is invalid')
            let expireIn = moment(newTime).format('MMMM Do YYYY, h:mm:ss a')
            this._expireIn = { date: newTime, nice: expireIn }
            if (this.debug) log({ message: 'cache will expire at', expireIn })
            this._expire = newTime
        }

        /** 
          * @listFiles
          * - list files in order from latest first
         */
        get listFiles() {
            return (fs.readdirSync(this.cacheDir) || [])
                .map(n => {
                    let dir = path.join(this.cacheDir, n)
                    if (fs.lstatSync(dir).isDirectory()) return null
                    else return n
                }).filter(n => !!n)
                .sort((a, b) => this.fileTimeStamp(b) - this.fileTimeStamp(a))
        }

        /** 
         * @makeDir
         * test if dir exists or make new one
        */
        makeDir(dirName) {

            let testSubName = new RegExp('[?!*,;#$@|"<>]', 'g')
            if (testSubName.test(dirName) || /\s/.test(dirName) || !dirName) {
                if (this.debug) onerror(`[addSubDir] dirName invalid, [?!%*:,;#$@|"<>], and no spaces allowed!`)
                return null
            }

            if (!fs.existsSync(dirName)) {

                /** 
                 * to consider other types
                    stats.isFile()
                    stats.isDirectory()
                    stats.isBlockDevice()
                    stats.isCharacterDevice()
                    stats.isSymbolicLink() (only valid with fs.lstat())
                    stats.isFIFO()
                    stats.isSocket()
                */

                try {
                    fs.existsSync()
                    fs.mkdirSync(dirName);
                    return true
                } catch (err) {
                    if (this.debug) onerror('[write]', err.toString())
                    return null
                }
            }
            return false
        }

        get defaultTime() {
            return { time: 1, format: 'h', str: '1h' }
        }

        /** 
         * every file is assigned with name `cache`
        */
        get cachePrefix() {
            return `cache`
        }

        get cacheDir() {
            return this._cacheDir || path.join(__dirname, `../cache`)
        }

        /** 
         * 
         * @param expire string (example: 1h,5m, 10s)
         * @returns {valid:true/false, format, time}
        */
        validFormat(expire) {
            let test = ['h', 'm', 's']
            let exp = (expire || '').toString().toLowerCase()

            let matched = test.filter(n => {
                if (exp.indexOf(n) !== -1) {
                    let expArr = exp.split(n).filter(n => !!n)
                    let [time] = expArr
                    if (expArr.length === 1 || Number(time) >= 0 && isNaN(Number(time)) === false) return true
                } else return false
            })

            // must include only 1 test pattern
            if (matched.length !== 1) return { valid: false }

            let timeS = exp.split(matched[0]).filter(n => !!n)
            let time = Number(timeS)
            return { format: matched[0], time, valid: true }
        }

        /** 
         * - when setting expire, format: {hour:min:sec}
         * @returns new timestamp
        */
        setDate(timeValue) {
            // NOTE set time far in to the future
            if (timeValue === Infinity) {
                timeValue = `11111111h`
                if (this.debug) log(`expire set to never expire`)
            }
            let timeFormat = this.validFormat(timeValue)
            if (!timeFormat.valid) {
                if (this.debug) warn(`[setDate] invalid format provided, setting`, { defaultTime: this.defaultTime })
                timeFormat = this.defaultTime
            }

            let d1 = new Date()
            let d2 = new Date(d1)
            if (timeFormat.format === 'h') d2.setHours(d1.getHours() + timeFormat.time)
            if (timeFormat.format === 'm') d2.setMinutes(d1.getMinutes() + timeFormat.time)
            if (timeFormat.format === 's') d2.setSeconds(d1.getSeconds() + timeFormat.time)
            if (!timeFormat.format) throw (' no timeFormat.format matched ')
            return d2.getTime()
        }


        /**
         * - keep desired file limit in your `cacheDir` path
         */
        fileLimit(limit = 0, override = null) {
            if (this.autoDeleteLimit > 0 && !override) {
                if (this.debug) warn(`[fileLimit] cannot use this method directly when autoDeleteLimit>0`)
                return this
            }
            if (limit < 1) return this
            let dir = this.listFiles

            let timeList = dir.map((file, inx) => {
                let timestamp = this.fileTimeStamp(file)
                if (timestamp !== null) return timestamp
            }).filter(n => !!n)
                .sort((a, b) => b - a) //NOTE  sort latest first 
            // keep latest file
            if (timeList.length === 1 && this.keepLast) return this
            if (this.keepLast) timeList.splice(0, limit)

            const uniqFilesByTimestamp = this.allUniqFiles.map(n => n.timestamp)
            let inxLessThen = (inx) => this.autoDeleteLimit > inx + 1
            // delete all else that repeats
            dir.forEach((file, inx) => {
                if (inxLessThen(inx)) return

                let timestamp = this.fileTimeStamp(file)
                // log(`removed by limit`, file)
                // means only test if autoDeleteLimit is not set,and keepLast is set
                let uniqFiles = this.keepLast && uniqFilesByTimestamp.indexOf(timestamp) !== -1 && this.autoDeleteLimit < 1
                if (uniqFiles) return
                if (timeList.indexOf(timestamp) !== -1) this.removeIt(file)
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
         * @allUniqFiles
         * - return all files that are uniq vy fname_
         * @returns [{fname, timestamp},...]
        */
        get allUniqFiles() {
            return uniqBy(this.listFiles.map(n => {
                let [fname, otherPart] = n.split(this.cachePrefix)
                let timestamp = otherPart.replace(/_/g, '').replace('.json', '')
                if (Number(timestamp) > 0) {
                    return { fname, timestamp: Number(timestamp) }
                } else return null
            }).filter(n => !!n), 'fname')
        }


        
        /** 
         * - return ordered fileListTimes
         * - keeps the list from first enquiry
        */
        get fileListTimes() {
            return this.listFiles.map(n => this.fileTimeStamp(n)).sort((a, b) => b - a)
        }

        errHandler(cacheName, _where) {
            if (!cacheName) {
                if (this.debug) onerror(`${_where} cacheName must be set`)
                return true
            }
            if (!isString(cacheName)) {
                if (this.debug) onerror(`${_where} cacheName must be a string`)
                return true
            }
            if (cacheName.split(' ').length > 1) {
                if (this.debug) onerror(`${_where} cacheName must cannot have spaces`)
                return true
            }
            if (cacheName.indexOf('.json') !== -1) {
                if (this.debug) onerror(`${_where} must provide cacheName without .json extention`)
                return true
            }
            if (cacheName.length < 3) {
                if (this.debug) onerror(`${_where} cacheName must be longer then 3`)
                return true
            }

            if (cacheName.indexOf('_') !== -1) {
                if (this.debug) onerror(`${_where} cacheName invalid format, cannot include '_'`)
                return true
            }

            if (cacheName.indexOf(this.cachePrefix) !== -1) {
                if (this.debug) onerror(`${_where} cacheName cannot include same name as cachePrefix: ${this.cachePrefix}`)
                return true
            }

            // test invalid cacheName chars
            let testFileChars = new RegExp('[/\\?%!*:,;#$|"<>]', 'g')
            if (testFileChars.test(cacheName)) {
                if (this.debug) onerror(`${_where} cacheName invalid format characters: [/\\?!%*:,;#$|"<>] `)
                return true
            }

            return false
        }


        /**
         * @findMatch
         * find latest match by date
         * return fileName, excluding file extension
         */
        findMatch(fileName) {
            if (this.errHandler(fileName, 'scanFind')) return ''

            let dir = this.listFiles
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
    }
}