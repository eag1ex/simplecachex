
const {log} = require('x-utils-es/umd')
const SimpleCache = require('./index')()
const path = require('path')

var debug = true // display any warnings

const opts = {
    silent:true, // do not show warnings on less critical errors
    // onlyWithCacheNamePrefix:true,
    smartUpdate:true, // write() method will perform update() check if data exists it will merge it
    keepLast:true, // keep last uniq file
    expire:Infinity, //'10s', // {time/Format}  "1h" "2m" "30s" (h/m/s)
    cacheDir:path.join(__dirname, "./mycache"),
    autoDeleteLimit:3 // NOTE regardless of expire only keep up to number set on cacheDir
}

const sc = new SimpleCache(opts, debug)

//sc.fileLimit(2) // NOTE direct call is ignored when autoDeleteLimit>0

var cacheName = 'job-ca-4' // has format restriction validation, enable `debug to see any errors or warnings`
var data = [{  hello:'word' }]//,
    //{ bankName: 'Deutsche Bank 9', assets: 10000 }] // 


// NOTE callback option for additional save/merge options can only be used when smartUpdate is enabled
sc.write(data,cacheName,(source, newData)=>{
    // NOTE source is data from cache
    return [].concat(source,newData)
})

// sc.write(data,cacheName)

// update existing `cacheName` with new data
// if (sc.exists(cacheName)) {
//     var newData = [{ bankName: 'China Bank', assets: 6000 }]
//     sc.update(newData,cacheName )
// } else {
//   //  sc.write(data,cacheName)
// }

// check expire
//  sc.expireIn

// NOTE load cache by name
const cache = sc.load(cacheName)
 log({cache})

// get all available cache
//log({ allCache: sc.getAll() })
return