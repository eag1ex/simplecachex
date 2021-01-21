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
    const { merge, isEmpty, isFunction } = require('lodash')
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
         * @getAll
         * retrieve all cache from current non-expired period
         */
        getAll() {
            let allCache = {}
            try {
                this.fileLimit(this.autoDeleteLimit, true)
                // latest first
                let dir = this.listFiles

                const load = (file) => {
                    let fileName = file
                    if (this.onlyWithCacheNamePrefix) {
                        if (fileName.indexOf(this.cacheName + '_') === 0) {
                            fileName = fileName.replace(this.cacheName + '_', '')
                            fileName = fileName.split('_')[0]
                        }

                    } else {
                        // add backward compatible support
                        if (fileName.indexOf(this.cacheName + '_') === 0 && !this.onlyWithCacheNamePrefix) {
                            fileName = null
                        } else fileName = fileName.split('_')[0]

                    }

                    if(fileName){
                        let d = this.load(fileName, undefined,undefined,true)
                        allCache[fileName] = d
                    }               
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
         * @param `cb((source,newData)=>)` optional, make your own merge betweend sources, must return callback or no update will be saved, and will override as new !
         * return boolean
         * @param __internal internal use, when smartUpdate is enabled so the write() method doesnt loop on its self and get callstack error
         */
        write(data, cacheName = '', cb, __internal = false) {

            if(!this.preValid(cacheName,'write') && !__internal){
                return false
            }

            if (this.errHandler(cacheName, 'write')) return false

            if (this.onlyWithCacheNamePrefix) {
                cacheName = this.cacheName + "_" + cacheName
            }

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
            let newFile

            newFile = path.join(this.cacheDir, 
                    `${cacheName}_${this.cachePrefix}_${this.expire}.json`) || ''



            /** 
             * - update or write to existing file if keepLast is set that file still exists, or keep creating new file
            */
            if (!fs.existsSync(newFile)) {
                if (this.keepLast) {
                    let firstFile = this.listFiles[0]
                    if (firstFile) {
                         

                        let firstFileName = firstFile.split(this.cachePrefix)[0].replace(/_/g, '') || ''
                        if(this.onlyWithCacheNamePrefix){
                            firstFileName = this.cacheName + '_'+ firstFileName
                        } 

                        // add back compatible support
                        let cacheNameWithNamePrefix = this.cacheName +'_'+cacheName

                        // NOTE this means when we do nto use onlyWithCacheNamePrefix but there are already files with that prefix, lets look for them also

                        let firstMatched =  (firstFileName.indexOf(cacheName) === 0 || firstFileName.indexOf(cacheNameWithNamePrefix) ===0) !==false

                        let firstFileNameWith = (firstFileName.length === cacheName.length || firstFileName.length === (this.cacheName +'_'+cacheName).length) !==false

                        if ((firstMatched && firstFileNameWith ) && (cacheName && firstFileName)) {

                           
                            if(firstFile.indexOf(this.cacheName+'_')!==0 && this.onlyWithCacheNamePrefix){
                                firstFile = this.cacheName + '_' + firstFile
                            }
                            
                            let testFile = path.join(this.cacheDir, firstFile)
                            if (fs.existsSync(testFile)) {
                                newFile = testFile
                            }
                        }
                    }
                }
            }

            if(!this.smartUpdate && isFunction(cb)){
                if(this.debug) warn(`[write] callback doesnt work without opts.smartUpdate setting enabled`)
            }

            // NOTE instead of checking with exists(cacheName) or doing update then write, when smartUpdate is set we can just call write() instead
            if (this.smartUpdate) {
                let _combineData = this._combineData(cacheName, data,cb, true, this.smartUpdate)
                if (_combineData.merged) data = _combineData.merged
                
                // NOTE delete previous dataPath with witch merged data and save to new file
                let updatePath = _combineData.updatePath              
                if(fs.existsSync(updatePath) && updatePath){
                        if( this.stripRootPath(updatePath)!==this.stripRootPath(newFile)){
                            this.removeIt(updatePath)  
                            // log('removed old reference',updatePath)
                        }
                }
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


        // TODO
        /** 
         * - adds support for subdir inside current cacheDir
        */
        // addSubDir(subName = '') {

        //     let testSubName = new RegExp('[?!%*:,;#$@|"<>]', 'g')
        //     if (testSubName.test(subName) || /\s/.test(subName) || !subName) {
        //         if (this.debug) onerror(`[addSubDir] subName invalid, [?%*:,;#$@|"<>], and no spaces allowed!`)
        //         return this
        //     }

        //     this.d = null
        //     if (subName.indexOf('/') === 0) subName = `.` + subName
        //     if (subName.indexOf('./') !==0 ) subName = `./` + subName
        //     let subDirPath = path.join(this.cacheDir, subName)
        //     let exists = this.makeDir(subDirPath)

        //     if (exists===false) {
        //        // if (this.debug) warn(`[addSubDir] subDir already exists: ${subDirPath}`)
        //     }
        //      log({subDirPath})
        //     // if it was null means some error and sub not written!!
        //     if(typeof exists ==='boolean') this.routeFile = subDirPath

        //     return this
        // }

        /** 
         * @exists
         * @param cacheName name poiting to your data file
         * @returns boolean
        */
        exists(cacheName = '') {
            if (!cacheName) return false

            if(!this.preValid(cacheName,'exists')){
                return false
            }

            if (this.errHandler(cacheName, 'exists')) return false

            if(this.onlyWithCacheNamePrefix){
                cacheName = this.cacheName+ "_"+cacheName
            }

            return !isFalsy(this.load(cacheName,undefined,undefined,true))
        }


        /**
         * @update
         * update with last cached file, 2 items must be eaqul type, array or object
         * @param newData required, array{}, or object{}
         * @param cb((source,newData)=>), optional, make your own merge decisions before update, must return callback, or nothing will save
         * @returns updated cacheName/data or false
         */
        update(newData,cacheName, cb) {
            if(!this.preValid(cacheName,'update')){
                return null
            }
            if (this.errHandler(cacheName, 'update')) return null

            if (isFalsy(newData)) {
                if (this.debug) warn('[update] cannot set falsy values')
                return null
            }

            if(this.onlyWithCacheNamePrefix){
                cacheName = this.cacheName+ "_"+cacheName
            }

            if (this.smartUpdate) {
                if (this.debug) log(`[update] if you want to use update(), disable smartUpdate option, waste of resources!`)
            }

            return this._combineData(cacheName, newData, ( isFunction(cb) ? cb:null ) , false)
        }


        /**
         * @load
         * load available data that hasn't expired
         * * return data
         */
        load(cacheName, smartUpdate, __full, __internal) {

            if(!__internal){
                if(!this.preValid(cacheName,'update')){
                    return null
                }
            }

            if(!__internal){
                if (this.errHandler(cacheName, 'load')) return false
            }
            

            // if(this.onlyWithCacheNamePrefix && !__internal){
            //     cacheName = this.cacheName+ "_"+cacheName
            // }

            if(this.onlyWithCacheNamePrefix && cacheName.indexOf(this.cacheName+'_')!==0){
                cacheName = this.cacheName+ "_"+cacheName
            }

            try {
                let foundFile = this.findMatch(cacheName,smartUpdate)
                if (!foundFile) {
                    if (this.debug && !smartUpdate) log(`${cacheName} file not found, or expired`)
                    return __full ? {}: null
                }
                // NOTE readFileSync works better then require
                // let d = require(`${this.cacheDir}/${foundFile}.json`) || null
                let _path = `${this.cacheDir}/${foundFile}.json`
                let d2 = JSON.parse(fs.readFileSync(_path))
                // NOTE __full for internal use and flexibility 
                
                return __full ? {
                    data:d2,
                    path:_path
                }: d2
               
            } catch (err) {
                if (this.debug && !this.silent) onerror(`${cacheName} file not found, or expired`)
                return __full ? {}: null    
            }
        }

        /** 
         * - combine two data types, conditionaly based on type
         * @param cacheName required
         * @param newData required
         * @param cb((source,newData)=>) optional, make your own merge betweend sources, must return callback
         * @returns merged data or null
        */
        _combineData(cacheName, newData, cb, __internal = true, smartUpdate=null) {
            let sourceData = this.load(cacheName,smartUpdate, true,true)
            if (isEmpty(sourceData.data)) return {}

            if (isObject(sourceData.data) && isObject(newData)) {
                let merged
              
                if (isFunction(cb))  {
                    merged = cb(sourceData.data, newData)
                    if(!merged){
                        if(this.debug) warn(`[combineData] callback didnt return any data, nothing will be saved`)
                        return {}
                    }
                    return {merged, updatePath:sourceData.path}
                }
                if(!isFunction(cb)) merged = merge(sourceData.data, newData) || {}
                if (__internal ) return {merged, updatePath:sourceData.path}
                else if(!__internal){
                    let done = this.write( merged,cacheName,null,null)
                    if (done) return merged
                }
            }

            if (isArray(sourceData.data) && isArray(newData)) {
                let merged 
                if (isFunction(cb)) {
                    merged = cb(sourceData.data, newData)

                    if (!merged) {
                        if (this.debug) warn(`[combineData] callback didnt return any data, nothing will be saved`)
                        return {}
                    }
                } 
                if(!isFunction(cb) ) merged = [].concat(sourceData.data,newData )
                if (__internal) return {merged, updatePath:sourceData.path}
                else if (!__internal){
                    let done = this.write( merged,cacheName,null,null)
                    if (done) return merged
                }

            } else {
                warn(`can only update/merge cache data that is of equal type!`)
                return null
            }
        }
    }

    return  SimpleCacheX
}
