## Simple CacheX
* By [EagleX](http://eaglex.net) 
* License: `CC BY` 

### About
* Simple Cache that can be adapted by any application, for server testing or any purpose. Cache is being saved in __{cacheDir}__ dir, can also be used as file database. 
* Every file is formated: `{cacheName}_cache_{timestamp}.json`

##### Methods
* `instance opts`:
   - `smartUpdate:boolean`: skips unnecessary call to update(), will perform check of data, and do merge on the fly
   - `keepLast:boolean`: will always keep latest file regardless of expiry or autoDeleteLimit
   - `expire:string`: valid format 1h, 20m, 59s (h/m/s)
   - `cacheDir:string`: optional when setting custom cache path, must provide full path, example: `path.join(__dirname, "./mycache")`
   -  `autoDeleteLimit:number`: optional to allow recycle old files first by limit specified, works together with `fileLimit(number)`

* `expireIn (getter)` : check expire date
* `exists(cacheName):boolean`: check if name pointing to data file exists
* `getAll()` : Read all available cache before expires
* `write(cacheName, data):void` : Write new cache, with timestamp. Can only provide data as object{} or array[], if `smartUpdate=true` was set then will also perform update first.
* `update(cacheName, data)` : Update/ and return existing cache, in a new file with new timestamp. Can only provide data as object{} or array[] 
* `load(cacheName)` : Load latest (by timestamp) cache before if exists.
* `fileLimit(limit:Number)` : recycle old files from `cacheDir` by limit number, can only use this method manualy when autoDeleteLimit is not set or autoDeleteLimit=0
- `data` : Can only provide data as object{} or array[] 
- `cacheName` : name cannot include any file extension, or underscore
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
    // smartUpdate:true,
    // keepLast:true, // always keep last file
    autoDeleteLimit: 15, // auto delete files by specified limit
    expire:'2h', // {time/Format}  "1h" "2m" "30s" (h/m/s)
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