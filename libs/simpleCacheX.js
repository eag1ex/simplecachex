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
    const { merge, isString, isEmpty, isNumber, uniqBy } = require('lodash')
    const path = require('path')
    const moment = require('moment')
    const { log, warn, onerror, isArray,isObject, isFalsy } = require('x-utils-es/umd')
  // const sq = require('simple-q')
    class SimpleCacheX {
        constructor(opts = {}, debug = false) {
            this.debug = debug
            
            // this._expire = 1 // default, or in hours >  (1, 3, 5, 0.5)
            this.keepLast = opts.keepLast || false // allow for latest cache file to remain, and not expire
            this._cacheDir = opts.cacheDir || null // or use default instead
            this.expire = opts.expire || this.defaultTime.str
            if(!opts.expire) {
                if(this.debug) log(`opts.expire not set setting defaultTime: ${opts.expire}`)
            }
            this._expireIn = null
            this.autoDeleteLimit = Number(opts.autoDeleteLimit) || 0 // NOTE check file limit every time new file is being created, when enabled (number provided), then set method `fileLimit()` can no longer be used maualy, but controlled by this setting
            if ((this.cacheDir || "").length < 2) throw ('provided wrong cacheDir')
            this.makeDir(this.cacheDir)
            this.removeExpired()
        }

        get defaultTime() {
            return { time: 1, format: 'h', str:'1h' }
        }

        /** 
         * - every file is assigned with name `cache`
        */
        get cachePrefix(){
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
                    let expArr = exp.split(n).filter(n=>!!n)
                    let [time] = expArr
                    if (expArr.length === 1 || Number(time)>=0 && isNaN(Number(time))===false ) return true
                } else return false
            })

            // must include only 1 test pattern
            if (matched.length !== 1) return { valid: false }

            let timeS = exp.split(matched[0]).filter(n=>!!n)
            let time = Number(timeS)
            return {format:matched[0],time, valid:true}
        }

        /** 
         * - when setting expire, format: {hour:min:sec}
         * @returns new timestamp
        */
        setDate(timeValue) {
            // NOTE set time far in to the future
            if(timeValue===Infinity) {
                timeValue = `11111111h`
                    if(this.debug) log(`expire has been to never expire`)
            }
            let timeFormat = this.validFormat(timeValue)
            if (!timeFormat.valid) {
                if (this.debug) warn(`[setDate] invalid format provided, setting`,{defaultTime:this.defaultTime})
                timeFormat = this.defaultTime
            }

            let d1 = new Date()
            let d2 = new Date(d1)
            if (timeFormat.format === 'h') d2.setHours(d1.getHours() + timeFormat.time)
            if (timeFormat.format === 'm') d2.setMinutes(d1.getMinutes() + timeFormat.time)
            if (timeFormat.format === 's') d2.setSeconds(d1.getSeconds() + timeFormat.time)
            if(!timeFormat.format) throw(' no timeFormat.format matched ')
            return d2.getTime()
        }

        get expireIn(){
            return this._expireIn
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
         * - test if dir exists or make new one
        */
        makeDir(dirName) {
            if (!fs.existsSync(dirName)) {
                try {
                    fs.mkdirSync(dirName);
                    return true
                } catch (err) {
                    if (this.debug) onerror('[write]', err.toString())
                    return false
                }
            }
            return true
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
            }).filter(n=>!!n)
              .sort((a, b) => b - a) //NOTE  sort latest first 
            // keep latest file
            if (timeList.length === 1 && this.keepLast)  return this
            if(this.keepLast) timeList.splice(0, limit)

            const uniqFilesByTimestamp =  this.allUniqFiles.map(n=>n.timestamp)
            let inxLessThen = (inx)=> this.autoDeleteLimit >inx+1
            // delete all else that repeats
            dir.forEach((file, inx) => {
                if(inxLessThen(inx)) return

                let timestamp = this.fileTimeStamp(file)
                 // log(`removed by limit`, file)
                    // means only test if autoDeleteLimit is not set,and keepLast is set
                let uniqFiles = this.keepLast && uniqFilesByTimestamp.indexOf(timestamp)!==-1 && this.autoDeleteLimit <1
                if(uniqFiles) return
                if (timeList.indexOf(timestamp) !== -1 ) this.removeIt(file)
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
        get allUniqFiles(){
            return  uniqBy(this.listFiles.map(n => {
                let [fname, otherPart] = n.split(this.cachePrefix)      
                let timestamp = otherPart.replace(/_/g, '').replace('.json','')              
                if (Number(timestamp) > 0) { 
                    return { fname, timestamp: Number(timestamp) }
                } else return null
            }).filter(n => !!n), 'fname')
        }

        /** 
         * - list files in order from latest first
        */
        get listFiles(){
            return (fs.readdirSync(this.cacheDir) || []).sort((a,b)=>{
                return this.fileTimeStamp(b) - this.fileTimeStamp(a)
            })
        }

        /** 
         * - return ordered fileListTimes
         * - keeps the list from first enquiry
        */
        get fileListTimes() {
            return (fs.readdirSync(this.cacheDir) || []).map(n => this.fileTimeStamp(n)).sort((a, b) => b - a)
        }

        /**
         * @removeExpired
         * * removes expired files
         */
        removeExpired() {

            try {
                let dir = this.listFiles
                const uniqFilesByTimestamp = this.allUniqFiles.map(n=>n.timestamp)

                let inxLessThen = (inx)=> this.autoDeleteLimit >inx+1

                dir.forEach((file, inx) => {
                   
                    if(inxLessThen(inx))  return
                   
                    let timestamp = this.fileTimeStamp(file)
                    if (timestamp !== null) {
                       let curTime = new Date().getTime()
                       
                       let keepLast = this.keepLast && this.fileListTimes[0] ? this.fileListTimes[0] || '' : ''
                       keepLast = keepLast && timestamp === keepLast
                       if(keepLast) return
                       
                       // means only test if autoDeleteLimit is not set,and keepLast is set
                       let unq =  uniqFilesByTimestamp.indexOf(timestamp)!==-1  &&  this.keepLast && this.autoDeleteLimit<1

                       if(unq) return
                        if (curTime >= timestamp ) {
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
            try {
                // latest first
                let dir = this.listFiles

                const load = (file)=>{
                    let fileName = file.split('_')[0]
                    let d = this.load(fileName)
                    allCache[fileName] = d
                }

                dir.forEach((file, inx) => {
                    let timestamp = this.fileTimeStamp(file)
                    if (timestamp !== null) {
                        let curTime = new Date().getTime()
                        if (curTime < timestamp)  return load(file)
                        if(this.keepLast && inx===0) load(file)
                    }
                })
              
                return allCache
            } catch (err) {
                if (this.debug) onerror(`[getAll]`, err.toString())
                return null
            }
        }

        errHandler(fileName, _where) {
            if (!fileName) {
                if (this.debug) onerror(`${_where} fileName must be set`)
                return true
            }
            if (!isString(fileName)) {
                if (this.debug) onerror(`${_where} fileName must be a string`)
                return true
            }
            if(fileName.split(' ').length>1){
                if (this.debug) onerror(`${_where} fileName must cannot have spaces`)
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

            if(fileName.indexOf(this.cachePrefix)!==-1){
                if (this.debug) onerror(`${_where} fileName cannot include same name as cachePrefix: ${this.cachePrefix}`)
                return true
            }

            // test invalid fileName chars
            let testFileChars = new RegExp('[/\\?%*:|"<>]','g')
            if(testFileChars.test(fileName)){
                if (this.debug) onerror(`${_where} fileName invalid format characters: [/\\?%*:|"<>] `)
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
        write(fileName='', data) {
            if (this.errHandler(fileName, 'write')) return false
            if (isFalsy(data)) {
                if (this.debug) warn('[write] cannot set falsy values')
                return false
            }

            // NOTE only delete files by limit when calling `write` method directly and  `autoDeleteLimit` is larger then 0
            this.fileLimit(this.autoDeleteLimit, true)
            let newFile = path.join(this.cacheDir, `${fileName}_${this.cachePrefix}_${this.expire}.json`) ||''

            /** 
             * - update or write to existing file if keepLast is set that file still exists, or keep creating new file
            */
            if (!fs.existsSync(newFile)) {
                if (this.keepLast) {
                    let firstFile = this.listFiles[0]
                    if(firstFile){
                        let firstFileName = firstFile.split(this.cachePrefix)[0].replace(/_/g,'') ||''
                        if ((firstFileName.indexOf(fileName)===0 && firstFileName.length===fileName.length) && (fileName && firstFileName)) {
                            let testFile = path.join(this.cacheDir,  firstFile)
                            if(fs.existsSync(testFile)) {
                                newFile = testFile
                            }
                        }
                    }  
                }
            }
            //console.log('new file?',`${fileName}_cache_${this.expire}.json`)
            try {
                fs.writeFileSync(newFile, JSON.stringify(data))
                return true
            } catch (err) {
                onerror('[write]', err.toString())
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
            if (isFalsy(newData)) {
                if (this.debug) warn('[update] cannot set falsy values')
                return false
            }

            let sourceData = this.load(fileName)
            if (isEmpty(sourceData)) return false

            if (isObject(sourceData) && isObject(newData)) {
                let merged = merge(sourceData, newData) || {}
                let done = this.write(fileName, merged)
                if (done) return merged
            }
            if (isArray(sourceData) && isArray(newData)) {
                let merged = [].concat(newData, sourceData)
                let done = this.write(fileName, merged)
                if (done) return merged
            } else {
                warn(`you can only update/merge data with last cache that is of eaqul type!`)
                return false
            }
          
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
                // NOTE readFileSync works better then require
                // let d = require(`${this.cacheDir}/${foundFile}.json`) || null
                let d2 = JSON.parse(fs.readFileSync(`${this.cacheDir}/${foundFile}.json`))
                return d2|| null
            } catch (err) {
                if (this.debug) onerror(`${fileName} file not found, or expired`)
                return null
            }
        }

        /**
         * @getAll
         * retrieve all cache from current non-expired period
         */
        getAll() {
            let allCache = {}
            try {
                // latest first
                let dir = this.listFiles

                const load = (file)=>{
                    let fileName = file.split('_')[0]
                    let d = this.load(fileName)
                    allCache[fileName] = d
                }

                dir.forEach((file, inx) => {
                    let timestamp = this.fileTimeStamp(file)
                    if (timestamp !== null) {
                        let curTime = new Date().getTime()
                        if (curTime < timestamp)  return load(file)
                        if(this.keepLast && inx===0) load(file)
                    }
                })
              
                return allCache
            } catch (err) {
                if (this.debug) onerror(`[getAll]`, err.toString())
                return null
            }
        }

    }
    return SimpleCacheX
}
