/*
 * Copyright 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/* jshint node: true, devel: true */
"use strict";

const bodyParser = require("body-parser"),
  config = require("config"),
  crypto = require("crypto"),
  express = require("express"),
  https = require("https"),
  request = require("request");

const edm = require("./edm.js");
const ticketType = require("./ticket_types.js");

var app = express();
app.set("port", process.env.PORT || 5000);
app.set("view engine", "ejs");
app.use(bodyParser.json({ verify: verifyRequestSignature }));
app.use(express.static("public"));

/*
 * Be sure to setup your config values before running this code. You can 
 * set them using environment variables or modifying the config file in /config.
 *
 */

// App Secret can be retrieved from the App Dashboard
const APP_SECRET = process.env.MESSENGER_APP_SECRET
  ? process.env.MESSENGER_APP_SECRET
  : config.get("appSecret");

// Arbitrary value used to validate a webhook
const VALIDATION_TOKEN = process.env.MESSENGER_VALIDATION_TOKEN
  ? process.env.MESSENGER_VALIDATION_TOKEN
  : config.get("validationToken");

// Generate a page access token for your page from the App Dashboard
const PAGE_ACCESS_TOKEN = process.env.MESSENGER_PAGE_ACCESS_TOKEN
  ? process.env.MESSENGER_PAGE_ACCESS_TOKEN
  : config.get("pageAccessToken");

// URL where the app is running (include protocol). Used to point to scripts and
// assets located at this address.
const SERVER_URL = process.env.SERVER_URL
  ? process.env.SERVER_URL
  : config.get("serverURL");

const BACKEND_SERVER_URL = config.get("backendServerURL");

const edms = edm.getEDMJSON(SERVER_URL);

if (!(APP_SECRET && VALIDATION_TOKEN && PAGE_ACCESS_TOKEN && SERVER_URL)) {
  console.error("Missing config values");
  process.exit(1);
}

// Serve the options path and set required headers
app.get("/options", (req, res, next) => {
  let referer = req.get("Referer");
  console.log(referer);

  if (referer) {
    if (referer.indexOf("www.messenger.com") >= 0) {
      res.setHeader("X-Frame-Options", "ALLOW-FROM https://www.messenger.com/");
    } else if (referer.indexOf("www.facebook.com") >= 0) {
      res.setHeader("X-Frame-Options", "ALLOW-FROM https://www.facebook.com/");
    }
    res.sendFile("public/options.html", { root: __dirname });
  }
});

// Handle postback from webview
app.get("/optionspostback", (req, res) => {
  let body = req.query;
  let response = {
    text: `Great, I will book you a ${body.bed} bed, with ${
      body.pillows
    } pillows and a ${body.view} view.`
  };

  res
    .status(200)
    .send("Please close this window to return to the conversation thread.");
  callSendAPI(body.psid, response);
});

/*
 * Use your own validation token. Check that the token used in the Webhook 
 * setup is the same token used here.
 *
 */
app.get("/webhook", function(req, res) {
  if (
    req.query["hub.mode"] === "subscribe" &&
    req.query["hub.verify_token"] === VALIDATION_TOKEN
  ) {
    console.log("Validating webhook");
    res.status(200).send(req.query["hub.challenge"]);
  } else {
    console.error("Failed validation. Make sure the validation tokens match.");
    res.sendStatus(403);
  }
});

/*
 * All callbacks for Messenger are POST-ed. They will be sent to the same
 * webhook. Be sure to subscribe your app to your page to receive callbacks
 * for your page. 
 * https://developers.facebook.com/docs/messenger-platform/product-overview/setup#subscribe_app
 *
 */
app.post("/webhook", function(req, res) {
  var data = req.body;

  // Make sure this is a page subscription
  if (data.object == "page") {
    // Iterate over each entry
    // There may be multiple if batched
    data.entry.forEach(function(pageEntry) {
      var pageID = pageEntry.id;
      var timeOfEvent = pageEntry.time;

      // Iterate over each messaging event
      pageEntry.messaging.forEach(function(messagingEvent) {
        console.log("messagingEvent");

        if (messagingEvent.optin) {
          receivedAuthentication(messagingEvent);
        } else if (messagingEvent.message) {
          receivedMessage(messagingEvent);
        } else if (messagingEvent.delivery) {
          receivedDeliveryConfirmation(messagingEvent);
        } else if (messagingEvent.postback) {
          receivedPostback(messagingEvent);
        } else if (messagingEvent.read) {
          receivedMessageRead(messagingEvent);
        } else if (messagingEvent.account_linking) {
          receivedAccountLink(messagingEvent);
        } else {
          console.log(
            "Webhook received unknown messagingEvent: ",
            messagingEvent
          );
        }
      });
    });

    // Assume all went well.
    //
    // You must send back a 200, within 20 seconds, to let us know you've
    // successfully received the callback. Otherwise, the request will time out.
    res.sendStatus(200);
  }
});

/*
 * Verify that the callback came from Facebook. Using the App Secret from 
 * the App Dashboard, we can verify the signature that is sent with each 
 * callback in the x-hub-signature field, located in the header.
 *
 * https://developers.facebook.com/docs/graph-api/webhooks#setup
 *
 */
function verifyRequestSignature(req, res, buf) {
  var signature = req.headers["x-hub-signature"];

  if (!signature) {
    // For testing, let's log an error. In production, you should throw an
    // error.
    console.error("Couldn't validate the signature.");
  } else {
    var elements = signature.split("=");
    var method = elements[0];
    var signatureHash = elements[1];

    var expectedHash = crypto
      .createHmac("sha1", APP_SECRET)
      .update(buf)
      .digest("hex");

    if (signatureHash != expectedHash) {
      throw new Error("Couldn't validate the request signature.");
    }
  }
}

/*
 * Message Event
 *
 * This event is called when a message is sent to your page. The 'message' 
 * object format can vary depending on the kind of message that was received.
 * Read more at https://developers.facebook.com/docs/messenger-platform/webhook-reference/message-received
 *
 * For this example, we're going to echo any text that we get. If we get some 
 * special keywords ('button', 'generic', 'receipt'), then we'll send back
 * examples of those bubbles to illustrate the special message bubbles we've 
 * created. If we receive a message with an attachment (image, video, audio), 
 * then we'll simply confirm that we've received the attachment.
 * 
 */
function receivedMessage(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfMessage = event.timestamp;
  var message = event.message;

  console.log(
    "Received message for user %d and page %d at %d with message:",
    senderID,
    recipientID,
    timeOfMessage
  );
  console.log(JSON.stringify(message));

  var isEcho = message.is_echo;
  var messageId = message.mid;
  var appId = message.app_id;
  var metadata = message.metadata;

  // You may get a text or attachment but not both
  var messageText = message.text.replace(/\s/g, "").toLowerCase();
  var messageAttachments = message.attachments;
  var quickReply = message.quick_reply;

  if (isEcho) {
    // Just logging message echoes to console
    console.log(
      "Received echo for message %s and app %d with metadata %s",
      messageId,
      appId,
      metadata
    );
    return;
  } else if (quickReply) {
    var quickReplyPayload = quickReply.payload;
    console.log(
      "Quick reply for message %s with payload %s",
      messageId,
      quickReplyPayload
    );

    sendTextMessage(senderID, "Quick reply tapped");
    return;
  }
  console.log("Message text is ", messageText);

  if (messageText) {
    // If we receive a text message, check to see if it matches any special
    // keywords and send back the corresponding example. Otherwise, just echo
    // the text we received.

    switch (messageText) {
      case "getstarted":
        sendInitialQuestion(senderID);
        break;
      case "showevents":
        sendEventList(senderID);
      default:
        sendTextMessage(
          senderID,
          "Thanks for your messages, our admin will contact you ASAP "
        );
    }
  } else if (messageAttachments) {
    sendTextMessage(senderID, "Message with attachment received");
  }
}

/*
 * Delivery Confirmation Event
 *
 * This event is sent to confirm the delivery of a message. Read more about 
 * these fields at https://developers.facebook.com/docs/messenger-platform/webhook-reference/message-delivered
 *
 */
function receivedDeliveryConfirmation(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var delivery = event.delivery;
  var messageIDs = delivery.mids;
  var watermark = delivery.watermark;
  var sequenceNumber = delivery.seq;

  if (messageIDs) {
    messageIDs.forEach(function(messageID) {
      console.log(
        "Received delivery confirmation for message ID: %s",
        messageID
      );
    });
  }

  console.log("All message before %d were delivered.", watermark);
}

/*
 * Postback Event
 *
 * This event is called when a postback is tapped on a Structured Message. 
 * https://developers.facebook.com/docs/messenger-platform/webhook-reference/postback-received
 * 
 */
function receivedPostback(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfPostback = event.timestamp;

  // The 'payload' param is a developer-defined field which is set in a postback
  // button for Structured Messages.
  var payload = event.postback.payload;

  console.log(
    "Received postback for user %d and page %d with payload '%s' " + "at %d",
    senderID,
    recipientID,
    payload,
    timeOfPostback
  );

  // When a postback is called, we'll send a message back to the sender to
  // let them know it was successful
  // sendTextMessage(senderID, "Postback called");
  switch (payload.replace(/\s/g, "").toLowerCase()) {
    case "getstarted":
      sendInitialQuestion(senderID);
      break;
    case "showevents":
      sendEventList(senderID);
      break;
    case "buyevent1":
      // Facebook is limited the button to 3, So if we have more we need to show again.showTicketsByEvent
      ticketType.showTicketsByEvent(
        senderID,
        "Event 1",
        BACKEND_SERVER_URL,
        callSendAPI
      );
      ticketType.showTicketsByEvent2(
        senderID,
        "Event 1",
        BACKEND_SERVER_URL,
        callSendAPI
      );

      break;
    case "buyevent2":
      ticketType.showTicketsByEvent(
        senderID,
        "Event 2",
        BACKEND_SERVER_URL,
        callSendAPI
      );
      ticketType.showTicketsByEvent2(
        senderID,
        "Event 2",
        BACKEND_SERVER_URL,
        callSendAPI
      );
      break;

    default:
      sendTextMessage(
        senderID,
        "Sorry I don't know what you talk about " + payload
      );
      break;
  }
}

/*
 * Message Read Event
 *
 * This event is called when a previously-sent message has been read.
 * https://developers.facebook.com/docs/messenger-platform/webhook-reference/message-read
 * 
 */
function receivedMessageRead(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;

  // All messages before watermark (a timestamp) or sequence have been seen.
  var watermark = event.read.watermark;
  var sequenceNumber = event.read.seq;

  console.log(
    "Received message read event for watermark %d and sequence " + "number %d",
    watermark,
    sequenceNumber
  );
}

/*
 * Handled the getting started button
 *
 */
function sendInitialQuestion(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [
            {
              title: "Welcome",
              subtitle: "You can inquiry about tickets",
              item_url: "https://www.facebook.com/mmravergyi/",
              image_url: "http://oi67.tinypic.com/2qk8o05.jpg",
              buttons: [
                {
                  type: "postback",
                  title: "Inquiry about tickets?",
                  payload: "showevents"
                },
                {
                  type: "phone_number",
                  title: "Call Phone Number",
                  payload: "+16505551234"
                }
              ]
            }
          ]
        }
      }
    }
  };

  callSendAPI(messageData);
}

/*
 * Show event list
 *
 */
function sendEventList(recipientId) {
  console.log(edms);

  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: edms
        }
      }
    }
  };

  callSendAPI(messageData);
}

/*
 * Send an image using the Send API.
 *
 */
function sendImageMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "image",
        payload: {
          url: SERVER_URL + "/assets/rift.png"
        }
      }
    }
  };

  callSendAPI(messageData);
}

/*
 * Call the Send API. The message data goes in the body. If successful, we'll 
 * get the message id in a response 
 *
 */
function callSendAPI(messageData) {
  request(
    {
      uri: "https://graph.facebook.com/v2.6/me/messages",
      qs: { access_token: PAGE_ACCESS_TOKEN },
      method: "POST",
      json: messageData
    },
    function(error, response, body) {
      if (!error && response.statusCode == 200) {
        var recipientId = body.recipient_id;
        var messageId = body.message_id;

        if (messageId) {
          console.log(
            "Successfully sent message with id %s to recipient %s",
            messageId,
            recipientId
          );
        } else {
          console.log(
            "Successfully called Send API for recipient %s",
            recipientId
          );
        }
      } else {
        console.error(
          "Failed calling Send API",
          response.statusCode,
          response.statusMessage,
          body.error
        );
      }
    }
  );
}

// Start server
// Webhooks must be available via SSL with a certificate signed by a valid
// certificate authority.
app.listen(app.get("port"), function() {
  console.log("Node app is running on port", app.get("port"));
});

module.exports = app;
