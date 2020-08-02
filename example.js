
const {log} = require('x-utils-es/umd')
const SimpleCache = require('./index')()
const path = require('path')

var debug = true // display any warnings

const opts = {
     keepLast:true, 
    expire: '10s', // {time/Format}  "1h" "2m" "30s" (h/m/s)
    cacheDir:path.join(__dirname, "./mycache"),
    //autoDeleteLimit:5
}

const sc = new SimpleCache(opts, debug)

// sc.fileLimit(5) // NOTE direct call to this is ignored when autoDeleteLimit>0

var fName = 'a-3abczntest' // has format restriction validation, enable `debug to see any errors or warnings`
var data = [{ bankName: 'Swiss Bank 1000000', assets: 10000 }]//,
    //{ bankName: 'Deutsche Bank 9', assets: 10000 }] // can be string or array/object of data

// sc.write(fName, data)
// sc.write(fName, data)
// sc.write(fName, data)


// update existing `fName` with new data
var newData = [{ bankName: 'China Bank2323',assets:-1775656 }] 
sc.update(fName, newData)

// check expire
//  sc.expireIn

// NOTE load cache by name
// const cache = sc.load(fName)
// log({cache})

// get all available cache
log({ allCache: sc.getAll() })
return