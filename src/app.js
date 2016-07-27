'use strict';

const apiai = require('apiai');
const express = require('express');
const bodyParser = require('body-parser');
const uuid = require('node-uuid');
const request = require('request');
const JSONbig = require('json-bigint');
const async = require('async');
const requestify = require('requestify');

const REST_PORT = (process.env.PORT || 5000);
const APIAI_ACCESS_TOKEN = process.env.APIAI_ACCESS_TOKEN;
const APIAI_LANG = process.env.APIAI_LANG || 'en';
const FB_VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN;
const FB_PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;

const apiAiService = apiai(APIAI_ACCESS_TOKEN, {language: APIAI_LANG, requestSource: "fb"});
const sessionIds = new Map();

function isMathEq(query) {

    if(query.indexOf('+') != -1)
    {
        return true;
    }else if(query.indexOf('-') != -1){
        return true;
    }else if(query.indexOf('*') != -1){
        return true;
    }else if(query.indexOf('/') != -1){
        return true;
    }else if(query.indexOf('^') != -1){
        return true;
    }
    return false;
}

function processEvent(event) {
    var sender = event.sender.id.toString();

    if(event.postback){
        let welcomeText = "Hi! I'm Eimi, your mobile persona. I am your Evolving Information Management Intelligence and I'm here to assist you! The more you use me, the more I learn! What can I do for you today?";
        sendFBMessage(sender, {text: welcomeText});
    }

    if (event.message && event.message.text) {
        var text = event.message.text;
        // Handle a text message from this sender

        if (!sessionIds.has(sender)) {
            sessionIds.set(sender, uuid.v1());
        }

        console.log("Text", text);

        let apiaiRequest = apiAiService.textRequest(text,
            {
                sessionId: sessionIds.get(sender)
            });

        apiaiRequest.on('response', (response) => {
            if (isDefined(response.result)) {

                let responseText = response.result.fulfillment.speech;
                let responseData = response.result.fulfillment.data;
                let action = response.result.action;
                let isActionNotComplete = response.result.actionIncomplete;
                let parameters = response.result.parameters;
                let resolvedQuery = response.result.resolvedQuery;


                // facebook API limit for text length is 320,
                // so we split message if needed
                //var splittedText = splitResponse(responseText);

                // async.eachSeries(splittedText, (textPart, callback) => {
                //     sendFBMessage(sender, {text: textPart}, callback);
                // });
                console.log("Response: "+responseText);

                if(isActionNotComplete == false){

                    console.log("action: "+action);
                    if(action == "sermonSearch"){

                        var weekArr = ['1st','2nd','3rd','4th','5th','first','second','third','fourth','fifth'];
                        var monthArr = ['january','february','march','april','may','june','july','august','september','october','november','december'];
                        var yearArr = ['2012','2013','2014','2015','2016'];

                        let sermon = parameters.sermonName;
                        let date = parameters.date;
                        let mediaType = parameters.mediaType;
                        var week,month,year;

                        var res = date.split(" ");
                        for (var i = 0; i < res.length; i++) {
                            var x = res[i].toLowerCase();
                            if(weekArr.indexOf(x) != -1 ){
                                week = x;
                                if(week == "first"){
                                    week = "1st";
                                }else if(week == "second"){
                                    week = "2nd";
                                }else if(week == "third"){
                                    week = "3rd";
                                }else if(week == "fourth"){
                                    week = "4th";
                                }else if(week == "fifth"){
                                    week = "5th";
                                }
                            }else if(monthArr.indexOf(x) != -1 ){
                                month = x;
                            }else if(yearArr.indexOf(x) != -1 ){
                                year = x;
                            }
                        };

                        let url = "https://eimi.io/sermondb.php?cruchorspeaker="+sermon+"&month="+month+"&week="+week+"&year="+year+"&audioorvideo="+mediaType;

                        console.log("Url: "+url);

                        requestify.get(url)
                        .then(function(response) {
                              var response = response.getBody();
                              response = response.trim();
                              if(response=="nulli"){
                                sendFBMessage(sender,{text: "No result found"});
                              }else{
                                response = response.replace(",,","");
                                let subtitle = "Listen to some of your favorite Bible teachings right here!";
                                let imgUrl = "https://eimi.io/img/church_logo.jpg";
                        		sendFBTemplateMessage(sender,response,subtitle,imgUrl,"Listen");
                              }
                        });

                    }else if(action == "bibleSearch"){
                        
                        let version = parameters.version;
                        let passage = parameters.passage;

                        let url = "https://eimi.io/biblesearch.php?passage="+passage+"&version="+version;

                        console.log("Bible Url",url);

                        requestify.get(url)
                        .then(function(response) {
                              response = response.getBody();
                              if(response.length<1){
                                sendFBMessage(sender,{text: "No result found"});
                              }else{
                                var splittedText = splitResponse(response);

                                async.eachSeries(splittedText, (textPart, callback) => {
                                    sendFBMessage(sender, {text: textPart}, callback);
                                });
                              }
                        });

                    }else if(action == "fetchPlace"){
                        let category = parameters.category;
                        let city = parameters.city;
                        console.log("category: "+category);
                        console.log("city: "+city);
                        requestify.get("https://eimi.io/dirdb.php?category="+category+"&city="+city)
                        .then(function(response) {
                            let responseArr = JSON.parse(response.getBody());
                            console.log("length: "+responseArr.length);
                            if(responseArr.length>0){
                                for (var i = 0; i < responseArr.length; i++) {
                                    
                                    var obj = responseArr[i];
                                
                                    var content = "";
                                    content += "Company: "+obj.company+"\nAddress: "+obj.address+"\nPhone: "+obj.number+"\nDescription: "+obj.desc+"\n";
                                    if(obj.web.length>1){
                                        content += "Web: "+obj.web+"\n";
                                    }
                                    if(obj.fb.length>1){
                                        content += "Facebook : "+obj.fb+"\n";
                                    }
                                    if(obj.twt.length>1){
                                        content += "Twitter : "+obj.twt+"\n";
                                    }
                                    if(obj.media.length>1){
                                        content += "Media : "+obj.media+"\n";
                                    }
                                    sendFBMessage(sender,{text: content});
                                }
                            }else{
                                sendFBMessage(sender,{text: "No Result Found"});
                            }
                        });
                    }else if(action == "getVerse"){
                        requestify.get("https://eimi.io/getverse.php")
                        .then(function(response) {
                            response = response.getBody();
                            sendFBMessage(sender,{text: response});  
                        });
                    }else if(action == "getPlanetsCal"){
                        requestify.get("https://eimi.io/wolfram/samples/simpleRequest.php?q="+resolvedQuery)
                        .then(function(response) {
                            response = response.getBody();
                            sendFBMessage(sender,{text: response});  
                        });
                    }else if(action == "getMoviewReview"){
                        let movie = parameters.name;
                        let url = "https://www.omdbapi.com/?t="+encodeURIComponent(movie)+"&y=&plot=short&r=json";
                        requestify.get(url)
                        .then(function(response) {
                            response = response.getBody();
                            if(response.Error){
                            	let elements = [];
                            	let obj = {};
	                            obj.title = "Not Found!";
	                            obj.image_url = "https://eimi.io/img/oops.jpg";
	                            obj.subtitle = "No such movie found.";
	                            elements[0]=obj;
	                    		sendFBElementMessage(sender,elements);
                            }else{
                            	sendFBMovieTemplateMessage(sender,response);
                            }  
                        });
                    }else if(action == "getBibleAnswer"){
                        let topic = parameters.topic;
                        let url = "http://www.gotquestions.org/search.php?zoom_query="+topic;
                        let subtitle = "We got answers from Bible that you want.";
                        let imgUrl = "https://eimi.io/img/bible_search_icon.jpeg";
                        sendFBTemplateMessage(sender,url,subtitle,imgUrl,"Here’s what I found!");
                    }else if(action == "getSearchResults"){
                    	let web = parameters.web;
                    	let query = parameters.query;

                    	requestify.get("https://eimi.io/lookupurls.php")
                        .then(function(response) {
                            response = JSON.parse(response.getBody());
                            var webUrl = "";

                            for (var i = 0; i < response.length; i++) {
                            	let obj = response[i];
                            	let alias = obj.alias;
                            	let aliasArr = alias.split(",");
                            	if(aliasArr.indexOf(web) != -1)
							    {
							        webUrl = obj.url;
							    }
                            }
                            if(webUrl.length>0){
                            	let url = webUrl+encodeURIComponent(query);
		                        let subtitle = "Here’s what I found!";
		                        let imgUrl = "https://eimi.io/img/search_icon.jpeg";
		                        sendFBTemplateMessage(sender,url,subtitle,imgUrl,"Tap me to get results");
                            }else{
                            	let elements = [];
                            	let obj = {};
	                            obj.title = "Not Found!";
	                            obj.image_url = "https://eimi.io/img/oops.jpg";
	                            obj.subtitle = "No result found. Try to search something else.";
	                            elements[0]=obj;
	                    		sendFBElementMessage(sender,elements);
                            }
                        });
                    }else if(action == "getBread"){
                    	var url = "";
                    	let type = parameters.type;
                    	if(type == "read"){
                    		url="http://odb.org/";
                    	}else{
                    		var date = new Date();
		                    var day = date.getDate();
		                    var month = date.getMonth()+1;
		                    var year1 = date.getFullYear().toString();
		                    let year = year1.substring(2);

		                    if(month<10){
		                        month = "0"+month;
		                    }
		                    if(day<10){
		                        day = "0"+day;
		                    }
		                    date = month+'-'+day+'-'+year;

		                    url = "http://odb.org/wp-content/themes/odbm-base/assets/download.php?file=http://dzxuyknqkmi1e.cloudfront.net/odb/"+year1+"/"+month+"/odb-"+date+".mp3";
                    	}

                    	let webUrl = url;
                        let subtitle = "We got the encouragement for you.";
                        let imgUrl = "https://eimi.io/img/Search_World.jpg";
                        sendFBTemplateMessage(sender,webUrl,subtitle,imgUrl,"Get Bread");
                    }else if(action == "getStoreLink"){
                    	let storeType = parameters.storeType.toLowerCase();

                    	if(storeType == "android"){
                    		let webUrl = "https://play.google.com/store/apps/details?id=ai.api.samplee";
	                        let subtitle = "Download Eimi from the playstore today!!";
	                        let imgUrl = "https://eimi.io/img/android.png";
		                    sendFBTemplateMessage(sender,webUrl,subtitle,imgUrl,"Get App");
                    	}else if(storeType == "ios" || storeType == "iphone"){
                    		let webUrl = "";
	                        let subtitle = "Download Eimi from the Appstore today!!";
	                        let imgUrl = "https://eimi.io/img/ios.png";
	                        sendFBTemplateMessage(sender,webUrl,subtitle,imgUrl,"Get App");
                    	}else{
                    		sendFBMessage(sender, {text: "I'm still learning about that myself. As soon as I know, you'll know."});
                    	}
                    }else if(action == "addReminder"){
                        let url = "http://eimi.io/get_offsets.php";
                        requestify.get(url)
                        .then(function(response) {
                            response = response.getBody();
                            response = JSON.parse(response);
                            var offset = "";
                            for (var i = 0; i < response.length; i++) {

                                 let obj = response[i];
                                 if(obj.sender == sender){
                                    offset = obj.offset;
                                 }
                             }
                             if(offset != ""){
                                let nowDate = new Date( new Date().getTime() + offset * 3600 * 1000);

                                let task = parameters.task;
                                let message = "Hey! You asked me to remind you "+task;

                                if(parameters.time.length>0){

                                    let time = parameters.time;
                                    let timeArr = time.split(":");
                                    let reminderDate = new Date();
                                    reminderDate.setHours(timeArr[0]);
                                    reminderDate.setMinutes(timeArr[1]);
                                    reminderDate.setSeconds(timeArr[2]);

                                    let reminderTime = reminderDate - nowDate;
                                    if(reminderDate<0){
                                        sendFBMessage(sender, {text: message});
                                    }else{
                                        setTimeout(function() {
                                            sendFBMessage(sender, {text: message});
                                        }, reminderTime);
                                    }
                                }else if(parameters.date.length>0){
                                    let date = parameters.date;
                                    sendFBMessage(sender, {text: date});
                                }else if(parameters.date_time.length>0){
                                    let date_time = parameters.date_time;
                                    sendFBMessage(sender, {text: date_time});
                                }
                             }else{
                                let m = "I don't know about your timezone. Please tell me about your city by saying  \"My city name is YourCityName\"";
                                sendFBMessage(sender, {text: m});
                             } 
                        });
                    }else if(action == "getTimeZone"){
                        let city = parameters.city;
                        let url = "https://api.apixu.com/v1/current.json?key=e40b422160674c86924201102162207&q="+city;
                        requestify.get(url)
                        .then(function(response) {
                            response = response.getBody();

                            let lat = response.location.lat;
                            let lon = response.location.lon;

                            let url1 = "http://api.geonames.org/timezoneJSON?lat="+lat+"&lng="+lon+"&username=awais4code";

                            requestify.get(url1)
                            .then(function(response) {
                                response = response.getBody();
                                let offset = response.dstOffset;

                                let url2 = "http://eimi.io/add_offsets.php?sender="+sender+"&offset="+offset;

                                requestify.get(url2)
                                .then(function(response) {
                                    response = response.getBody();
                                    let message = "Thanks for recording timezone!\nNow You can ask me to remind your tasks by saying something like this \"Remind me to go to the team meeting at 4:30pm\"";
                                    sendFBMessage(sender,{text: message});  
                                });

                            });

                        });
                    }else{
                        let splittedText = splitResponse(responseText);

                        async.eachSeries(splittedText, (textPart, callback) => {
                            sendFBMessage(sender, {text: textPart}, callback);
                        });
                    }
                }else{
                    if(isMathEq(resolvedQuery)){

                        let url = "https://eimi.io/wolfram/samples/simpleRequest.php?q="+encodeURIComponent(resolvedQuery)+"";

                        requestify.get(url)
                        .then(function(response) {
                            response = response.getBody();
                            sendFBMessage(sender,{text: response});  
                        });
                    }else if(action == "weather.search"){
                    	let location = parameters.location;
                    	let url = "https://api.apixu.com/v1/current.json?key=e40b422160674c86924201102162207&q="+location;

                    	requestify.get(url)
                        .then(function(response) {
                            response = response.getBody();

                    		let elements = [];

                    		if(response.error){

                    			let obj = {};
	                            obj.title = "Not Found!";
	                            obj.image_url = "https://eimi.io/img/oops.jpg";
	                            obj.subtitle = "No matching location found.";
	                            elements[0]=obj;
	                    		sendFBElementMessage(sender,elements);

                    		}else{
                            
	                            let weather = response.current.condition.text;
	                            let temprature = response.current.temp_f+" F ("+response.current.temp_c+")";
	                            let city = response.location.name+","+response.location.region+","+response.location.country;
	                            let humadity = response.current.humidity;
	                            let wind = response.current.wind_mph+" mph";

	                            let title = "Weather report of "+city;
	                            let imgUrl = "https://eimi.io/img/weather_icon.jpeg";
	                            let subtitle1 = "Weather is "+weather+" and wind is "+wind;
	                            let subtitle2 = "Temprature is "+temprature+" and humadity is "+humadity;
								

	                            let obj1 = {};
	                            obj1.title = title;
	                            obj1.image_url = imgUrl;
	                            obj1.subtitle = subtitle1;
	                            elements[0]=obj1;

	                            let obj2 = {};
	                            obj2.title = title;
	                            obj2.image_url = imgUrl;
	                            obj2.subtitle = subtitle2;
	                            elements[1]=obj2;

	                    		sendFBElementMessage(sender,elements);
                    		}

                        });

                    }else{
                        if(responseText.length>0){
                            let splittedText = splitResponse(responseText);

                            async.eachSeries(splittedText, (textPart, callback) => {
                                sendFBMessage(sender, {text: textPart}, callback);
                            });
                        }else{
                            let respText = "I'm still learning about that myself. As soon as I know, you'll know.";
                            sendFBMessage(sender, {text: respText});
                        }
                    }
                }

            }
        });

        apiaiRequest.on('error', (error) => console.error(error));
        apiaiRequest.end();
    }
}

function splitResponse(str) {
    if (str.length <= 320)
    {
        return [str];
    }

    var result = chunkString(str, 300);

    return result;

}

function chunkString(s, len)
{
    var curr = len, prev = 0;

    var output = [];

    while(s[curr]) {
        if(s[curr++] == ' ') {
            output.push(s.substring(prev,curr));
            prev = curr;
            curr += len;
        }
        else
        {
            var currReverse = curr;
            do {
                if(s.substring(currReverse - 1, currReverse) == ' ')
                {
                    output.push(s.substring(prev,currReverse));
                    prev = currReverse;
                    curr = currReverse + len;
                    break;
                }
                currReverse--;
            } while(currReverse > prev)
        }
    }
    output.push(s.substr(prev));
    return output;
}

function sendFBMessage(sender, messageData, callback) {
    request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {access_token: FB_PAGE_ACCESS_TOKEN},
        method: 'POST',
        json: {
            recipient: {id: sender},
            message: messageData
        }
    }, function (error, response, body) {
        if (error) {
            console.log('Error sending message: ', error);
        } else if (response.body.error) {
            console.log('Error: ', response.body.error);
        }

        if (callback) {
            callback();
        }
    });
}

function sendFBTemplateMessage(sender, url, subtitle, imgUrl, buttonTitle, callback) {
    request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {access_token: FB_PAGE_ACCESS_TOKEN},
        method: 'POST',
        json: {
            recipient: {id: sender},
            message:{
            attachment:{
              type:'template',
              payload:{
                template_type:'generic',
                elements:[
                  {
                    title:'I am Eimí-Your Mobile Persona',
                    image_url:imgUrl,
                    subtitle:subtitle,
                    buttons:[
                      {
                        type:'web_url',
                        url:url,
                        title:buttonTitle
                      }              
                    ]
                  }
                ]
              }
            }
          }

        }
    }, function (error, response, body) {
        if (error) {
            console.log('Error sending message: ', error);
        } else if (response.body.error) {
            console.log('Error: ', response.body.error);
        }

        if (callback) {
            callback();
        }
    });
}

function sendFBElementMessage(sender, templateElements, callback) {
    request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {access_token: FB_PAGE_ACCESS_TOKEN},
        method: 'POST',
        json: {
            recipient: {id: sender},
            message:{
            attachment:{
              type:'template',
              payload:{
                template_type:'generic',
                elements:templateElements
              }
            }
          }

        }
    }, function (error, response, body) {
        if (error) {
            console.log('Error sending message: ', error);
        } else if (response.body.error) {
            console.log('Error: ', response.body.error);
        }

        if (callback) {
            callback();
        }
    });
}

function sendFBMovieTemplateMessage(sender, movObj, callback) {
    request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {access_token: FB_PAGE_ACCESS_TOKEN},
        method: 'POST',
        json: {
            recipient: {id: sender},
            message:{
            attachment:{
              type:'template',
              payload:{
                template_type:'generic',
                elements:[
                  {
                    title:movObj.Title,
                    image_url:movObj.Poster,
                    subtitle:'Rated: "'+movObj.Rated+'" Metascore: "'+movObj.Metascore+'" Rating: "'+movObj.imdbRating+'" Votes: "'+movObj.imdbVotes+'"',
                    buttons:[
                      {
                        type:'web_url',
                        url:'http://www.imdb.com/title/'+movObj.imdbID,
                        title:'Watch Trailer'
                      }
                    ]
                  }
                ]
              }
            }
          }

        }
    }, function (error, response, body) {
        if (error) {
            console.log('Error sending message: ', error);
        } else if (response.body.error) {
            console.log('Error: ', response.body.error);
        }

        if (callback) {
            callback();
        }
    });
}

function doSubscribeRequest() {
    request({
            method: 'POST',
            uri: "https://graph.facebook.com/v2.6/me/subscribed_apps?access_token=" + FB_PAGE_ACCESS_TOKEN
        },
        function (error, response, body) {
            if (error) {
                console.error('Error while subscription: ', error);
            } else {
                console.log('Subscription result: ', response.body);
            }
        });
}

function isDefined(obj) {
    if (typeof obj == 'undefined') {
        return false;
    }

    if (!obj) {
        return false;
    }

    return obj != null;
}

const app = express();

app.use(bodyParser.text({ type: 'application/json' }));

app.get('/webhook/', function (req, res) {
    if (req.query['hub.verify_token'] == FB_VERIFY_TOKEN) {
        res.send(req.query['hub.challenge']);
        
        setTimeout(function () {
            doSubscribeRequest();
        }, 3000);
    } else {
        res.send('Error, wrong validation token');
    }
});

app.post('/webhook/', function (req, res) {
    try {
        var data = JSONbig.parse(req.body);

        var messaging_events = data.entry[0].messaging;
        for (var i = 0; i < messaging_events.length; i++) {
            var event = data.entry[0].messaging[i];
            processEvent(event);
        }
        return res.status(200).json({
            status: "ok"
        });
    } catch (err) {
        return res.status(400).json({
            status: "error",
            error: err
        });
    }

});

app.listen(REST_PORT, function () {
    console.log('Rest service ready on port ' + REST_PORT);
});

doSubscribeRequest();