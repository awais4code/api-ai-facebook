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
    var isMathEq = false;
    if(query.indexOf('+') != -1)
    {
        isMathEq = true;
    }else if(query.indexOf('-') != -1){
        isMathEq = true;
    }else if(query.indexOf('*') != -1){
        isMathEq = true;
    }else if(query.indexOf('/') != -1){
        isMathEq = true;
    }else if(query.indexOf('^') != -1){
        isMathEq = true;
    }
    console.log("bool:"+isMathEq);
    return isMathEq;
}

function processEvent(event) {
    var sender = event.sender.id.toString();

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


                if (isDefined(responseData) && isDefined(responseData.facebook)) {
                    try {
                        console.log('Response as formatted message');
                        sendFBMessage(sender, responseData.facebook);
                    } catch (err) {
                        sendFBMessage(sender, {text: err.message });
                    }
                } else if (isDefined(responseText)) {
                    // facebook API limit for text length is 320,
                    // so we split message if needed
                    //var splittedText = splitResponse(responseText);

                    // async.eachSeries(splittedText, (textPart, callback) => {
                    //     sendFBMessage(sender, {text: textPart}, callback);
                    // });
                    console.log("Response: "+responseText);

                    if(isActionNotComplete == false){

                        // console.log("action: "+action);
                        // if(action == "sermonSearch"){

                        //     var weekArr = ['1st','2nd','3rd','4th','5th','first','second','third','fourth','fifth'];
                        //     var monthArr = ['january','february','march','april','may','june','july','august','september','october','november','december'];
                        //     var yearArr = ['2012','2013','2014','2015','2016'];

                        //     let sermon = parameters.sermonName;
                        //     let date = parameters.date;
                        //     let mediaType = parameters.mediaType;
                        //     var week,month,year;

                        //     var res = date.split(" ");
                        //     for (var i = 0; i < res.length; i++) {
                        //         var x = res[i].toLowerCase();
                        //         if(weekArr.indexOf(x) != -1 ){
                        //             week = x;
                        //             if(week == "first"){
                        //                 week = "1st";
                        //             }else if(week == "second"){
                        //                 week = "2nd";
                        //             }else if(week == "third"){
                        //                 week = "3rd";
                        //             }else if(week == "fourth"){
                        //                 week = "4th";
                        //             }else if(week == "fifth"){
                        //                 week = "5th";
                        //             }
                        //         }else if(monthArr.indexOf(x) != -1 ){
                        //             month = x;
                        //         }else if(yearArr.indexOf(x) != -1 ){
                        //             year = x;
                        //         }
                        //     };

                        //     let url = "https://eimi.io/sermondb.php?cruchorspeaker="+sermon+"&month="+month+"&week="+week+"&year="+year+"&audioorvideo="+mediaType;

                        //     console.log("Url: "+url);

                        //     requestify.get(url)
                        //     .then(function(response) {
                        //           var response = response.getBody();
                        //           response = response.trim();
                        //           if(response=="nulli"){
                        //             sendFBMessage(sender,{text: "No result found"});
                        //           }else{
                        //             response = response.replace(",,","");
                        //             sendFBMessage(sender,{text: "Click it to access media: \n"+response});
                        //           }
                        //     });

                        // }else if(action == "bibleSearch"){
                            
                        //     let version = parameters.version;
                        //     let passage = parameters.passage;

                        //     let url = "https://eimi.io/biblesearch.php?passage="+passage+"&version="+version;

                        //     console.log("Bible Url",url);

                        //     requestify.get(url)
                        //     .then(function(response) {
                        //           response = response.getBody();
                        //           if(response.length<1){
                        //             sendFBMessage(sender,{text: "No result found"});
                        //           }else{
                        //             var splittedText = splitResponse(response);

                        //             async.eachSeries(splittedText, (textPart, callback) => {
                        //                 sendFBMessage(sender, {text: textPart}, callback);
                        //             });
                        //           }
                        //     });

                        // }else if(action == "fetchPlace"){
                        //     let category = parameters.category;
                        //     let city = parameters.city;
                        //     console.log("category: "+category);
                        //     console.log("city: "+city);
                        //     requestify.get("https://eimi.io/dirdb.php?category="+category+"&city="+city)
                        //     .then(function(response) {
                        //         let responseArr = JSON.parse(response.getBody());
                        //         console.log("length: "+responseArr.length);
                        //         if(responseArr.length>0){
                        //             for (var i = 0; i < responseArr.length; i++) {
                                        
                        //                 var obj = responseArr[i];
                                    
                        //                 var content = "";
                        //                 content += "Company: "+obj.company+"\nAddress: "+obj.address+"\nPhone: "+obj.number+"\nDescription: "+obj.desc+"\n";
                        //                 if(obj.web.length>1){
                        //                     content += "Web: "+obj.web+"\n";
                        //                 }
                        //                 if(obj.fb.length>1){
                        //                     content += "Facebook : "+obj.fb+"\n";
                        //                 }
                        //                 if(obj.twt.length>1){
                        //                     content += "Twitter : "+obj.twt+"\n";
                        //                 }
                        //                 if(obj.media.length>1){
                        //                     content += "Media : "+obj.media+"\n";
                        //                 }
                        //                 sendFBMessage(sender,{text: content});
                        //             }
                        //         }else{
                        //             sendFBMessage(sender,{text: "No Result Found"});
                        //         }
                        //     });
                        // }else if(action == "getVerse"){
                        //     requestify.get("https://eimi.io/getverse.php")
                        //     .then(function(response) {
                        //         response = response.getBody();
                        //         sendFBMessage(sender,{text: response});  
                        //     });
                        // }else if(action == "getPlanetsCal"){
                        //     requestify.get("https://eimi.io/wolfram/samples/simpleRequest.php?q="+resolvedQuery)
                        //     .then(function(response) {
                        //         response = response.getBody();
                        //         sendFBMessage(sender,{text: response});  
                        //     });
                        // }else{
                        //     let splittedText = splitResponse(responseText);

                        //     async.eachSeries(splittedText, (textPart, callback) => {
                        //         sendFBMessage(sender, {text: textPart}, callback);
                        //     });
                        // }
                        sendFBMessage(sender,{text: "response1"});
                    }else{
                        if(isMathEq(resolvedQuery)){
                            // console.log("Math Eq");
                            // requestify.get("https://eimi.io/wolfram/samples/simpleRequest.php?q="+encodeURIComponent(resolvedQuery))
                            // .then(function(response) {
                            //     response = response.getBody();
                            //     sendFBMessage(sender,{text: response});  
                            // });
                            sendFBMessage(sender,{text: "Math Eq"});
                        }else{
                            // console.log("In Else");
                            // let splittedText = splitResponse(responseText);

                            // async.eachSeries(splittedText, (textPart, callback) => {
                            //     sendFBMessage(sender, {text: textPart}, callback);
                            // });
                            sendFBMessage(sender,{text: "response"});
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