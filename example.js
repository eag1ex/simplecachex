
const {log} = require('x-utils-es/umd')
const SimpleCache = require('./index')()
const path = require('path')

var debug = true // display any warnings

const opts = {
   // keepLast:true, 
    expire: '20s', // valid format 1h, 20m, 59s (h/m/s)
    cacheDir:path.join(__dirname, "./mycache"),
    autoDeleteLimit:3
}

const sc = new SimpleCache(opts, debug)

// sc.fileLimit(5) // NOTE direct call to this is ignored when autoDeleteLimit>0

var fName = '3-4-5-test' // has format restriction validation, enable `debug to see any errors or warnings`
var data = { bankName: 'Swiss Bank 100', assets: 10000 }//,
    //{ bankName: 'Deutsche Bank 9', assets: 10000 }] // can be string or array/object of data

// sc.write(fName, data)
// sc.write(fName, data)
// sc.write(fName, data)
// var cache = sc.load(fName) // load cache data

// update with new data
// var newData = [{ bankName: 'China Bank2323', assets: 10000 }] // will update existing `fName` with new data
// var cache = sc.update(fName, newData)
// //  sc.expireIn // NOTE can access only if created/updated the file
// log({ cache })

// get all available cache

log({ allCache: sc.getAll() })
return