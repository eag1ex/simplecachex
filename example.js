
const {log} = require('x-utils-es/umd')
const SimpleCache = require('./index')()
const path = require('path')

var debug = true // display any warnings

const opts = {
    smartUpdate:true, // write() method will perform update() check if data exists it will merge it
    keepLast:true, // keep last uniq file
    expire:Infinity, //'10s', // {time/Format}  "1h" "2m" "30s" (h/m/s)
    cacheDir:path.join(__dirname, "./mycache"),
    autoDeleteLimit:5 // NOTE regardless of expire only keep up to number set on cacheDir
}

const sc = new SimpleCache(opts, debug)

//sc.fileLimit(2) // NOTE direct call is ignored when autoDeleteLimit>0

var cacheName = 'job-c' // has format restriction validation, enable `debug to see any errors or warnings`
var data = [{ bankName: 'Swiss Bank', assets: 2222 }]//,
    //{ bankName: 'Deutsche Bank 9', assets: 10000 }] // 


sc.write(cacheName, data)
// sc.write(cacheName, data)

// update existing `cacheName` with new data
// if (sc.exists(cacheName)) {
//     var newData = [{ bankName: 'China Bank', assets: 20000 }]
//     sc.update(cacheName, newData)
// } else {
//     sc.write(cacheName, data)
// }

// check expire
//  sc.expireIn

// NOTE load cache by name
// const cache = sc.load(fName)
// log({cache})

// get all available cache
log({ allCache: sc.getAll() })
return