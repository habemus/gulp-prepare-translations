// native
const path = require('path');
const fs   = require('fs');

// third-party
const through = require('through2');
const PluginError = require('gulp-util').PluginError;
const File = require('vinyl');
const objectPath = require('object-path');
const Bluebird = require('bluebird');

const JSONStableStringify = require('json-stable-stringify');

// promisify
Bluebird.promisifyAll(fs);

// constants
const PLUGIN_NAME = 'gulp-prepare-translations';

module.exports = function gulpPrepareTranslations(options) {
  
  if (!options) {
    throw new Error('options is required');
  }
  
  if (!options.languages) {
    throw new Error('options.languages is required');
  }
  
  if (!options.patterns) {
    throw new Error('options.patterns is required');
  }
  
  // ensure options.patterns is an array of regular expressions
  options.patterns = Array.isArray(options.patterns) ?
    options.patterns : [options.patterns];
  
  // default value to which untranslated keys will be set
  options.defaultTranslation = options.defaultTranslation || null;

  var latestFile;
  var extractedTranslationKeys = [];

  /**
   * Retrieves all matches' capture group value
   * 
   * @param {RegExp} re
   * @param {String} str
   * @param {Number} capture
   */
  function _matchesCapture(re, str, capture) {
    
    capture = capture || 1;
    
    // create a new reg exp so that `exec` is always starting from zero
    re = new RegExp(re);

    var results = [];
    var currMatch;
    
    do {
      
      currMatch = re.exec(str);
      
      if (currMatch) {
        results.push(currMatch[capture]);
      }
      
    } while (currMatch);

    return results;
  }

  function bufferContents(file, encoding, cb) {
    
    if (file.isNull()) {
      // nothing to do
      return cb();
    }

    if (file.isStream()) {
      this.emit('error', new PluginError(PLUGIN_NAME, 'Streams not supported!'));
      
    } else if (file.isBuffer()) {
      
      var fileContents = file.contents.toString();
      
      var fileTranslationKeys = options.patterns.reduce((res, regexp) => {
        
        return res.concat(_matchesCapture(regexp, fileContents));
        
      }, []);
      
      extractedTranslationKeys =
        extractedTranslationKeys.concat(fileTranslationKeys);

      latestFile = file;

      return cb();
    }
  }

  function endStream(cb) {
    // no files passed in, no file goes out
    if (!latestFile) {
      cb();
      return;
    }
    
    return Bluebird.all(options.languages.map((language) => {
            
      if (typeof language === 'string') {
        language = {
          code: language,
        };
      }
      
      var dest = language.dest || language.code + '.json';
      
      // clone everything from the latest file (taken from gulp-concat)
      var file = latestFile.clone({contents: false});
      file.path = path.join(latestFile.base, dest);
      
      // a promise for the source translations
      var srcPromise;
      
      if (!language.src) {
        srcPromise = Bluebird.resolve({});
      } else if (typeof language.src === 'string') {
        srcPromise = fs.readFileAsync(language.src, 'utf8').then((contents) => {
          return JSON.parse(contents);
        });
      } else if (typeof language.src === 'object') {
        srcPromise = Bluebird.resolve(language.src);
      } else {
        throw new PluginError(PLUGIN_NAME, 'unsupported language.src ' + language.src);
      }
      
      return srcPromise.then((translations) => {
        
        return extractedTranslationKeys.reduce((res, key) => {
          
          var isKeyTranslated = (typeof objectPath.get(res, key) === 'string' ||
                                 typeof objectPath.get(res, key) === 'number');
          
          if (!isKeyTranslated) {
            
            var value;
            
            if (typeof options.defaultTranslation === 'function') {
              value = options.defaultTranslation(key);
            } else {
              value = options.defaultTranslation;
            }
            
            objectPath.set(res, key, value);
          }
          
          return res;
          
        }, translations);
        
      })
      .then((translations) => {
        
        // stringify alphabetically
        var translationsStr = JSONStableStringify(translations, {
          space: '  '
        });
        
        file.contents = new Buffer(translationsStr);
        
        this.push(file);
      });
    }))
    .then(() => {
      cb();
    });
  }

  return through.obj(bufferContents, endStream);
};
