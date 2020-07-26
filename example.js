
const {log} = require('x-utils-es/umd')
const SimpleCache = require('./index')()

/// var expire = -1 // 0.1 === 10min
var debug = true // display any warnings

const opts = {
    expire:-1
    // cacheDir: >> full path
}
const sc = new SimpleCache(opts, debug)
sc.fileLimit(1)
var fName = 'bankData12' // has format restriction validation, enable `debug to see any errors or warnings`
var data = [{ bankName: 'Swiss Bank 7', assets: 10000 },
    { bankName: 'Deutsche Bank 9', assets: 10000 }] // can be string or array/object of data

sc.write(fName, data)
var cache = sc.load(fName) // load cache data

// update with new data
var newData = [{ bankName: 'China Bank', assets: 10000 }] // will update existing `fName` with new data
var cache = sc.update(fName, newData)
//  sc.expireIn // NOTE can access only if created/updated the file
log({ cache })

// get all available cache
log({ allCache: sc.getAll() })
 