## Simple CacheX
* By [EagleX](http://eaglex.net) 
* License: `CC BY` 

### About
* Simple cache that can be adapted by any application, for server testing or any purpose. Cache is being saved in `./cache` dir.

##### Methods
* `getAll()` : Read all available cache before expires
* `write(fileName, data):void` : Write new cache, with timestamp 
* `update(fileName, data)` : Update/ and return existing cache, in a new file with new timestamp
* `load(fileName)` : Load latest (by timestamp) cache before if exists.
* `fileLimit(limit:Number)` : Keep desired file limit in your cacheDir, ordered by latest
- `data` : Data can be a string, array, or object
- `fileName` : name cannot include any file extension, or underscore
- `debug:Boolean` : You can enable debug to see any errors or warnings
- `expire:Number`: Set your expire time, default is 1 hour.

#### Cache
* cache is being saved in `./cache` dir every new file is appended with timestamp, old files depending on `expire` setting are recycled. If you update your cache, it will be created in a new file together with new information, the old file will still exist - but will be recycled after expiry. Cache expiry is tested every time the app runs. Example file path `./cache/bankData_cache_1569331380306.json`


###### Installation:
* `npm i`


### Example usage:
```
const SimpleCache = require('./simpleCacheX')()
var debug = true // display any warnings

const opts = {
    expire:0.1 // 10min // or -1 (no limit/indefinite)
    // cacheDir: >> full path // defaults to `./cache` dir at root of simplecachex app
}

const sc = new SimpleCache(opts, debug)

// get all available cache 
sc.getAll()
var fName = 'bankData' // has format restriction validation, enable `debug to see any errors or warnings`

var data = [{bankName:'Swiss Bank', assets:10000},
            {bankName:'Deutsche Bank', assets:10000}] // can be string or array/object of data

sc.write(fName, data)
var newData = [{bankName:'China Bank', assets:10000}]  // will update existing `fName` with new data
var cache = sc.update(fName,newData)
var cache = sc.load(fName) // load cache data

// look at `./example.js` for more examples. 

```

###### Other
* Have questions, or would like to submit feedback, `contact me at: https://eaglex.net/app/contact?product=SimpleCacheX`