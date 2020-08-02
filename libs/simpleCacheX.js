/**
 * @SimpleCacheX
 * * Version : 1.0.0
 * * License: `CC BY`
 * * Build by `EagleX Technologies.`
 * * A Local to file data store, for testing purposes only
 * * In live environment this may not be desirable, you may want to use `Redis`
 * * Files are stored as per setting in `{cacheDir}`
 * * every file is formated: {cacheName}_cache_{timestamp}.json
 */
module.exports = () => {

    const fs = require('fs')
    const { merge, isEmpty } = require('lodash')
    const path = require('path')
    const { log, warn, onerror, isArray, isObject, isFalsy } = require('x-utils-es/umd')
    const Libs = require('./simpleCacheX.libs')()

    class SimpleCacheX extends Libs {
        constructor(opts, debug) {
            super(opts, debug)

        }

        get expireIn() {
            return this._expireIn
        }

        /**
         * @removeExpired
         * * removes expired files
         */
        removeExpired() {

            try {
                let dir = this.listFiles
                const uniqFilesByTimestamp = this.allUniqFiles.map(n => n.timestamp)

                let inxLessThen = (inx) => this.autoDeleteLimit > inx + 1

                dir.forEach((file, inx) => {

                    if (inxLessThen(inx)) return

                    let timestamp = this.fileTimeStamp(file)
                    if (timestamp !== null) {
                        let curTime = new Date().getTime()

                        let keepLast = this.keepLast && this.fileListTimes[0] ? this.fileListTimes[0] || '' : ''
                        keepLast = keepLast && timestamp === keepLast
                        if (keepLast) return

                        // means only test if autoDeleteLimit is not set,and keepLast is set
                        let unq = uniqFilesByTimestamp.indexOf(timestamp) !== -1 && this.keepLast && this.autoDeleteLimit < 1

                        if (unq) return
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
            try {
                // latest first
                let dir = this.listFiles

                const load = (file) => {
                    let fileName = file.split('_')[0]
                    let d = this.load(fileName)
                    allCache[fileName] = d
                }

                dir.forEach((file, inx) => {
                    let timestamp = this.fileTimeStamp(file)
                    if (timestamp !== null) {
                        let curTime = new Date().getTime()
                        if (curTime < timestamp) return load(file)
                        if (this.keepLast && inx === 0) load(file)
                    }
                })

                return allCache
            } catch (err) {
                if (this.debug) onerror(`[getAll]`, err.toString())
                return null
            }
        }


        /**
         * @write
         * * write file to cache dir
         * * must provide {cacheName} and {data}
         * * file written in format: {cacheName}_cache_{timestamp}.json
         * @param {array/object} data required, pust prodive either array[] or object{} data formats  
         * return boolean
         */
        write(data, cacheName= '',__internal) {

            if (this.errHandler(cacheName, 'write')) return false
            if (isFalsy(data)) {
                if (this.debug) warn('[write] cannot set falsy values')
                return false
            }
            const isValidFormat = isArray(data) || isObject(data) ? true : false
            if (!isValidFormat) {
                if (this.debug) onerror(`[write] cannot write data because its neither array, or object`)
                return false
            }

            // NOTE only delete files by limit when calling `write` method directly and  `autoDeleteLimit` is larger then 0
            this.fileLimit(this.autoDeleteLimit, true)
            let newFile = path.join(this.cacheDir, `${cacheName}_${this.cachePrefix}_${this.expire}.json`) || ''

            /** 
             * - update or write to existing file if keepLast is set that file still exists, or keep creating new file
            */
            if (!fs.existsSync(newFile)) {
                if (this.keepLast) {
                    let firstFile = this.listFiles[0]
                    if (firstFile) {
                        let firstFileName = firstFile.split(this.cachePrefix)[0].replace(/_/g, '') || ''
                        if ((firstFileName.indexOf(cacheName) === 0 && firstFileName.length === cacheName.length) && (cacheName && firstFileName)) {
                            let testFile = path.join(this.cacheDir, firstFile)
                            if (fs.existsSync(testFile)) {
                                newFile = testFile
                            }
                        }
                    }
                }
            }

            // NOTE instead of checking with exists(cacheName) or doing update then write, when smartUpdate is set we can just call write() instead
            if (this.smartUpdate) {
                let _combineData = this._combineData(cacheName, data, true)
                if (_combineData) data = _combineData
            }

            //console.log('new file?',`${cacheName}_cache_${this.expire}.json`)
            try {
                fs.writeFileSync(newFile, JSON.stringify(data))
                return true
            } catch (err) {
                onerror('[write]', err.toString())
                return false
            }
        }

        // TODO lets not use routeFile concept, instead use exampel: /subdir/cacheName
        // toSubDir(subName) {
        //     this.addSubDir(subName) // generates this.routeFile
        //     if (!this.routeFile) {
        //         if (this.debug) warn(`[toSubDir] subName invalid`)
        //         return this
        //     }
        //     if (!fs.lstatSync(this.routeFile).isDirectory() && !this.routeFile) {
        //         this.routeFile = null
        //         if (this.debug) warn(`[toSubDir] subName invalid, or an error`)
        //     }

        //     return this
        // }

        /** 
         * - adds support for subdir inside current cacheDir
        */
        addSubDir(subName = '') {

            let testSubName = new RegExp('[?%*:,;#$@|"<>]', 'g')
            if (testSubName.test(subName) || /\s/.test(testSubName) || !subName) {
                if (this.debug) onerror(`[addSubDir] subName invalid, [?%*:,;#$@|"<>], and no spaces allowed!`)
                return this
            }

            this.d = null
            if (subName.indexOf('/') === 0) subName = `.` + subName
            if (subName.indexOf('./') !==0 ) subName = `./` + subName
            let subDirPath = path.join(this.cacheDir, subName)
            log({subDirPath})
            let exists = this.makeDir(subDirPath)

            if (exists===false) {
                if (this.debug) warn(`[addSubDir] subDir already exists: ${subDirPath}`)
            }
            // if it was null means some error and sub not written!!
            if(typeof exists ==='boolean') this.routeFile = subDirPath

            return this
        }

        /** 
         * @exists
         * @param cacheName name poiting to your data file
         * @returns boolean
        */
        exists(cacheName = '') {
            if (!cacheName) return false
            return !isFalsy(this.load(cacheName))
        }


        /**
         * @update
         * update with last cached file, 2 items must be eaqul type, array or object
         * @returns updated cacheName/data or false
         */
        update(newData,cacheName) {
            if (this.errHandler(cacheName, 'update')) return null
            if (isFalsy(newData)) {
                if (this.debug) warn('[update] cannot set falsy values')
                return null
            }

            if (this.smartUpdate) {
                if (this.debug) log(`[update] if you want to use update(), disable smartUpdate option, waste of resources!`)
            }
            return this._combineData(cacheName, newData, false)
        }


        /**
         * @load
         * load available data that hasn't expired
         * * return data
         */
        load(cacheName) {

            if (this.errHandler(cacheName, 'load')) return false

            try {
                let foundFile = this.findMatch(cacheName)
                if (!foundFile) {
                    if (this.debug) log(`${cacheName} file not found, or expired`)
                    return null
                }
                // NOTE readFileSync works better then require
                // let d = require(`${this.cacheDir}/${foundFile}.json`) || null
                let d2 = JSON.parse(fs.readFileSync(`${this.cacheDir}/${foundFile}.json`))
                return d2 || null
            } catch (err) {
                if (this.debug) onerror(`${cacheName} file not found, or expired`)
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

                const load = (file) => {
                    let fileName = file.split('_')[0]
                    let d = this.load(fileName)
                    allCache[fileName] = d
                }

                dir.forEach((file, inx) => {
                    let timestamp = this.fileTimeStamp(file)
                    if (timestamp !== null) {
                        let curTime = new Date().getTime()
                        if (curTime < timestamp) return load(file)
                        if (this.keepLast && inx === 0) load(file)
                    }
                })

                return allCache
            } catch (err) {
                if (this.debug) onerror(`[getAll]`, err.toString())
                return null
            }
        }


        /** 
         * - combine two data types, conditionaly based on type
         * @param cacheName required
         * @param origin required
         * @returns merged data or null
        */
        _combineData(cacheName, newData, __internal = true) {
            let sourceData = this.load(cacheName)
            if (isEmpty(sourceData)) return null

            if (isObject(sourceData) && isObject(newData)) {
                let merged = merge(sourceData, newData) || {}
                if (__internal) return merged
                else {
                    let done = this.write( merged,cacheName)
                    if (done) return merged
                }
            }

            if (isArray(sourceData) && isArray(newData)) {
                let merged = [].concat(newData, sourceData)
                if (__internal) return merged
                else {
                    let done = this.write( merged,cacheName)
                    if (done) return merged
                }

            } else {
                warn(`can only update/merge cache data that is of equal type!`)
                return null
            }
        }

    }
    return SimpleCacheX
}
