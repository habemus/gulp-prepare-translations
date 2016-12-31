// native
const path = require('path');

// third-party
const should  = require('should');
const fse     = require('fs-extra');
const vinylFs = require('vinyl-fs');

// lib
const gulpPrepareI18n = require('../../');

const FIXTURES_PATH = path.join(__dirname, '../fixtures');
const TMP_PATH      = path.join(__dirname, '../tmp');

describe('basics', function () {
  
  beforeEach(function () {
    fse.emptyDirSync(TMP_PATH);
  });
  
  it('should work', function () {
    
    return new Promise((resolve, reject) => {
      vinylFs.src(FIXTURES_PATH + '/sample-project/**/*')
        .pipe(gulpPrepareI18n({
          languages: [
            {
              code: 'en-US',
              src: path.join(FIXTURES_PATH, 'sample-project/translations/en-US.json'),
            },
            {
              code: 'pt-BR',
              src: require(FIXTURES_PATH + '/sample-project/translations/pt-BR.json'),
            }
          ],
          patterns: [
            /_t\('(.+)'\)/g,
            /data-translate="(.+)"/g,
          ],
        }))
        .on('error', reject)
        .pipe(vinylFs.dest(TMP_PATH))
        .on('end', resolve)
    });
    
  });
  
});
