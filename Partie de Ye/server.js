//------------------------------------------------
//WebSvr.js
//  an example of building a web server
//------------------------------------------------

//a message to show the states of the server
console.time('[WebSvr][Start]');

//module of requests
var libHttp = require('http');    //HTTP module
var libUrl=require('url');    //URL analysing module
var libFs = require("fs");    //file system module
var libPath = require("path");    //path analysing module


//get the type of requiring file for the head of http
var funGetContentType=function(filePath){
    var contentType="";

    //get the extra name of file
    var ext=libPath.extname(filePath);

    switch(ext){
        case ".html":
            contentType= "text/html";
            break;
        case ".js":
            contentType="text/javascript";
            break;
        case ".css":
            contentType="text/css";
            break;
        case ".gif":
            contentType="image/gif";
            break;
        case ".jpg":
            contentType="image/jpeg";
            break;
        case ".png":
            contentType="image/png";
            break;
        case ".ico":
            contentType="image/icon";
            break;
        default:
        contentType="application/octet-stream";
    }

    return contentType; //return the type
}

//main function. analyse requests and return
var funWebSvr = function (req, res){  
    var reqUrl=req.url; //get url

    //print url
    console.log(reqUrl);

    //get pathname of url
    var pathName = libUrl.parse(reqUrl).pathname; 
	

    if (libPath.extname(pathName)=="") {
        //if there is no extra name
            pathName+="/"; //return catalog
    }
    
    if (pathName.charAt(pathName.length-1)=="/"){
        //if ask for index
            pathName+="index.html"; //return index
    }
    
    //using path analysing module
    var filePath = libPath.join("./WebRoot",pathName);

    //judge if the document exists  
    libFs.exists(filePath,function(exists){
            if(exists){//exist
            //write type of file in response
            res.writeHead(200, {"Content-Type": funGetContentType(filePath) });
 
            //create read-only stream for return
            var stream = libFs.createReadStream(filePath, {flags : "r", encoding : null}); 

            //if stream comes out an error, return 404
            stream.on("error", function() { 
                res.writeHead(404); 
                      res.end("<h1>404 Read Error</h1>"); 
              }); 
            
            //combine file stream and actual response stream
            stream.pipe(res);
            } 
        else { //file not exist

            //return 404 error
            res.writeHead(404, {"Content-Type": "text/html"});
            res.end("<h1>404 Not Found</h1>");
        }
        });


    
}

//create the web server
var webSvr=libHttp.createServer(funWebSvr);

//the error response function
webSvr.on("error", function(error) { 
  console.log(error);  //output the error messages
}); 

//begin to listen 8124 port
webSvr.listen(8124,function(){

    //print the message in console
    console.log('[WebSvr][Start] running at http://127.0.0.1:8124/'); 

    //end the timer and print the time
    console.timeEnd('[WebSvr][Start]');
});


//this part is sending and receiving messages
var io = require('socket.io').listen(webSvr);
var exec = require('child_process').exec;
var errorCode;
var ifcData;
var objOrigin;
var objData;
var mtlData;
var numofobj;
var files = [];

// get and send message with client
io.sockets.on('connection', function(socket){
    //send time informations to client
    setInterval(function(){
        socket.emit('date', {'date': new Date()});
    }, 1000);

    //get request from client
    socket.on('client_data', function(data){
		console.log("[client required]" + data.letter + '.ifc.obj');
        
		ReadFileAndSendData(socket,data.letter);
		
    });
});

var SendData = function(file, socket){
	libFs.readFile(file, 'utf8', function (err,data) {
		if (err) {
			socket.emit('server_data', {'data': errorCode})
			return (err);
		}
		socket.emit('server_data', {'data': data});
		console.log("[sendData] sent data successfully!");
    });
}

//get the require and send the file to the client
var ReadFileAndSendData = function(socket,file){
	FindIFCAndCreateOBJ(file);

    SendData('WebRoot/files/'+file+'.ifc.obj', socket);
	for(var i = 0; i<files.length;i++){
		SendData('WebRoot/files/'+ file +'/'+files[i], socket);
	}
}

//judge if a file exists. Transform a ifc file to obj file.
var FindIFCAndCreateOBJ = function(file){
	libFs.stat('WebRoot/files/'+file+'.ifc', function(err, stat) {
		if(err == null) {
			libFs.stat('WebRoot/files/'+file+'.ifc.obj', function(err, stat){
				if(err == null){
						console.log("[createOBJ] this obj exists!");
						ReadFiles(file);
				}else{				
					//send this document!
					console.log("[createOBJ] this obj doesn't exists!");
					console.log("[createOBJ] creating obj...");
					var cmd = 'IfcObj.exe WebRoot/files/' + file +'.ifc';
					exec(cmd, function(error, stdout, stderr) {
						console.log("[createOBJ] transformed ifc to obj!");
						ReadFiles(file);
					})
					errorCode = 2;				
				}
			})
		} else if(err.code == 'ENOENT') {
			console.log("[createOBJ] this ifc doesn't exist!");
			errorCode = 1;
		} else {
			console.log('errors：' + err);
		}
	});
}

//read the ifc and obj file then use DevideObj function, you have to use FindIFCAndCreateOBJ to make sure ifc and obj exist
var ReadFiles = function(file){
	libFs.readFile('WebRoot/files/'+file+'.ifc.obj', 'utf8', function (err,data) {
		if (err) {
			return (err);
		}
		objOrigin = data;
		libFs.readFile('WebRoot/files/'+file+'.ifc.mtl', 'utf8', function (err,data) {
			if (err) {
				return (err);
			}
			mtlData = data;
			
			DevideObj(file);
		});
    });
	
	return 1;
}

//get the file name and divide into smaller objs
var DevideObj = function(file){
	//console.log(mtlData);
	//console.log("::::::::::::::::" + npart);
	var patt = /newmtl .+/g;
	var parts = mtlData.match(patt);
	var npart = parts.length;
	console.log("[obj split]there are " + npart + "objs");
	var tempstr = (objOrigin + 'g').replace(/\ng /g, "\ng g ");
	var path = 'WebRoot/files/'+ file+'/';
	

	if (!libFs.existsSync(path)) {
		libFs.mkdirSync(path);
	}
		
	//console.log(tempstr);
	for(var i = 0; i< npart; i++){
		parts[i] = parts[i].substr(7);
		console.log("[obj split]creating" + parts[i]+".obj");
		patt = eval("/usemtl " + parts[i] + "[\\s\\S]*?\\ng/g");
		var subparts = tempstr.match(patt);
		var nsubpart = subparts.length;
		//console.log("::::::::" + nsubpart);
		
		var filename = file +parts[i]+'.obj';
		files.push(filename);
		objData = "mtllib ../"+ file +".ifc.mtl\n";
		for(var j = 0; j < nsubpart; j++){
			objData += "g " + (i+1) + "\ns 1\n";
			objData += subparts[j].substr(0,subparts[j].length-1);
		}
		
		console.log("success create");
		
		libFs.open(path + filename,"a",0644,function(e,fd){
			if(e) return e;
		});
		libFs.writeFile(path + filename,objData,function(e){
			if(e) return e;
		})
		
		console.log("success ecrite");
	}
}
