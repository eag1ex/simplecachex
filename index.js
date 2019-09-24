
const notify = require('./libs/notifications')()
const SimpleCache = require('./simpleCacheX')()

var expire = 0.1 // 10min
var debug = true // display any warnings
const sc = new SimpleCache(expire, debug)

var fName = 'bankData' // has format restriction validation, enable `debug to see any errors or warnings`
var data = [{ bankName: 'Swiss Bank', assets: 10000 },
    { bankName: 'Deutsche Bank', assets: 10000 }] // can be string or array/object of data

sc.write(fName, data)
var cache = sc.load(fName) // load cache data

// update with new data
// var newData = [{ bankName: 'China Bank', assets: 10000 }] // will update existing `fName` with new data
// var cache = sc.update(fName, newData)

notify.ulog({ cache })

// get all available cache
// notify.ulog({ allCache: sc.getAll() })
