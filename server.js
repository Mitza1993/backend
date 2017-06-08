/**
 * Created by miordache on 5/3/17.
 */

var express = require('express');
var https = require('https');
var fs = require('fs');
var userData = {};
var container = "";
var path = require('path');
var Q = require('q');
var mkdirp = require('mkdirp');
var app = express();
var bodyParser = require('body-parser');
var cors = require('cors');
var readline = require('readline');
var PORT = process.env.PORT || 3003;
var HOST = process.env.HOST || '';
var azure = require('azure-storage');
var _ = require('lodash');
var serveStatic = require('serve-static')
var router = express.Router();
var models = [];


const  AZURE_STORAGE_CONNECTION_STRING="AZUREDefaultEndpointsProtocol=https;AccountName=decorator;AccountKey=aZXpLV8zItQWfSN+y3UxauxJxUEwCWRM1NrtkIUAbZchGjC2775pNYV/dGU8vm7vGny/FyYGOB6QRKYn9S/Bhw==;EndpointSuffix=core.windows.net";
const AZURE_STORAGE_ACCESS_KEY="aZXpLV8zItQWfSN+y3UxauxJxUEwCWRM1NrtkIUAbZchGjC2775pNYV/dGU8vm7vGny/FyYGOB6QRKYn9S/Bhw==";
const AZURE_STORAGE_ACCOUNT="decorator";

var blobService = azure.createBlobService(AZURE_STORAGE_ACCOUNT,AZURE_STORAGE_ACCESS_KEY,"",null);

app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());


app.use(cors());
app.options('*',cors());

router.use(function(req, res, next) {
  // do logging
  console.log('Notification being processed.');
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next(); // make sure we go to the next routes and don't stop here
});

app.use('/api', router);
app.use('/files', express.static('mihaiiordache'));

router.route('/store')
    .post(function(req,res) {
        userData = req.body;
        console.log(req.body);

        container = req.body.name.replace(/ /g,"").toLowerCase();

        if (!fs.existsSync(container)) {
            fs.mkdirSync(container);
        }


        // removeContent(container);
        models = [];
        downloadFiles().then(function() {
            res.send({
                items: models
            });
            res.end("finished");
        })

});

function downloadFiles() {
    var deferred = Q.defer();

    blobService.listBlobsSegmented(container, null, function(error, result, response){
        if(!error) {
            _.forEach(result.entries, function(entry, index) {
                //concat index with file format
                models.push(index + ".wt3");
                //save files locally
                blobService.getBlobToStream(container, entry.name, fs.createWriteStream(container + "/" + index + ".wt3"), function(error, result, response){
                    if(!error){
                    } else {
                        deferred.reject();
                    }
                });
                deferred.resolve();
            });
        } else {
            deferred.reject();
        }
    });
    return deferred.promise;
}


router.route('/list')
  .get(function(req,res) {

    res.end('Get works :/');
  });


//
// var options = {
//   key  : fs.readFileSync('ssl/key.pem'),
//   ca   : fs.readFileSync('ssl/csr.pem'),
//   cert : fs.readFileSync('ssl/cert.pem')
// };

https.createServer({
  key: fs.readFileSync('ssl/key.pem'),
  cert: fs.readFileSync('ssl/cert.pem'),
  passphrase: 'xxx'
},app).listen(PORT, HOST, null, function() {
    console.log('Server listening on port %d in %s mode', this.address().port, app.settings.env);
});

function getUnauthorizedResponse(req) {
  var message = req.auth ?
    ('Credentials ' + req.auth.user + ':' + req.auth.password + ' rejected') :
    'No credentials provided';
  return {error: message};
}

//manage googleDrive files
var loggedUser = {}
var google = require('googleapis');
var googleAuth = require('google-auth-library');

// If modifying these scopes, delete your previously saved credentials
// at ~/.credentials/drive-nodejs-quickstart.json
var SCOPES = ['https://www.googleapis.com/auth/drive.file'];
var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH ||
  process.env.USERPROFILE) + '/.credentials/';
var TOKEN_PATH = TOKEN_DIR + 'drive-nodejs-quickstart.json';

function authorize(credentials, callback) {
  var clientSecret = credentials.installed.client_secret;
  var clientId = credentials.installed.client_id;
  var redirectUrl = credentials.installed.redirect_uris[0];
  var auth = new googleAuth();
  var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, function(err, token) {
    if (err) {
      getNewToken(oauth2Client, callback);
    } else {
      oauth2Client.credentials = JSON.parse(token);
      callback(oauth2Client);
    }
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized
 *     client.
 */
function getNewToken(oauth2Client, callback) {
  var authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES
  });
  console.log('Authorize this app by visiting this url: ', authUrl);
  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rl.question('Enter the code from that page here: ', function(code) {
    rl.close();
    oauth2Client.getToken(code, function(err, token) {
      if (err) {
        console.log('Error while trying to retrieve access token', err);
        return;
      }
      oauth2Client.credentials = token;
      storeToken(token);
      callback(oauth2Client);
    });
  });
}

/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
function storeToken(token) {
  try {
    fs.mkdirSync(TOKEN_DIR);
  } catch (err) {
    if (err.code != 'EEXIST') {
      throw err;
    }
  }
  fs.writeFile(TOKEN_PATH, JSON.stringify(token));
  console.log('Token stored to ' + TOKEN_PATH);
}

/**
 * Lists the names and IDs of up to 10 files.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function listFiles(auth) {
  var q = Q.defer();
  var service = google.drive('v3');
  service.files.list({
    auth: auth,
    pageSize: 10,
    fields: "nextPageToken, files(id, name)"
  }, function(err, response) {
    if (err) {
      console.log('The API returned an error: ' + err);
      q.reject();
      return;
    }
    var files = response.files;
    if (files.length == 0) {
      console.log('No files found.');
    } else {
      console.log('Files:');
      for (var i = 0; i < files.length; i++) {
        var file = files[i];
        if((file.name).indexOf('.wt3') > -1) {
          checkUserRights(file,auth);
        }
      }
      q.resolve();
    }
  });
  return q.promise;
}

function checkUserRights(file,auth) {
  var service = google.drive('v2');

  service.permissions.getIdForEmail({
    auth: auth,
    email: loggedUser.email
  }, function(err, response) {
    if(err) {
      console.log(err);
    }
    checkUserRole(file, response.id);
  });

function checkUserRole(file,permissionId) {
  service.permissions.get({
    auth: auth,
    fileId: file.id,
    permissionId: permissionId
  }, function(err,response){
    if(err) {
      console.log(err.message);
    }
    if(response) {
      if(response.role === 'owner' || response.role === 'writer') {
        downloadFile(file);
      }
    }
  });
}

function downloadFile() {
  var dest = fs.createWriteStream(loggedUser.email + "/" + file.name);

  service.files.get({
    auth: auth,
    fileId: file.id,
    alt: 'media'
  })
    .on('end', function(response) {
      console.log("File retrieved");
    })
    .on('error', function(err) {
      console.log("Error");
    })
    .pipe(dest);
  }
}

function removeContent(dirPath, removeSelf) {
    if (removeSelf === undefined)
        removeSelf = true;
    try { var files = fs.readdirSync(dirPath); }
    catch(e) { return; }
    if (files.length > 0)
        for (var i = 0; i < files.length; i++) {
            var filePath = dirPath + '/' + files[i];
            if (fs.statSync(filePath).isFile())
                fs.unlinkSync(filePath);
            else
                rmDir(filePath);
        }
    if (removeSelf)
        fs.rmdirSync(dirPath);
}
