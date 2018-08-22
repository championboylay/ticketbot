exports.showTicketsByEvent = function(
  recipientId,
  eventName,
  backend_server,
  callback
) {
  const callbackURL = backend_server + "/options";
  const messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text: "Ticket Types for " + eventName,
          buttons: [
            {
              type: "web_url",
              url:
                callbackURL +
                "?event=" +
                eventName +
                "&ticket=General Access (GA)&price=30000",
              title: "GA (30000)",
              webview_height_ratio: "full"
            },
            {
              type: "web_url",
              url: callbackURL,
              title: "PGA (50000)",
              webview_height_ratio: "tall"
            },
            {
              type: "web_url",
              url: callbackURL,
              title: "VIP (10000)",
              webview_height_ratio: "compact"
            }
          ]
        }
      }
    }
  };
  callback(messageData);
};

exports.showTicketsByEvent2 = function(
  recipientId,
  eventName,
  backend_server,
  callback
) {
  const messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text: "Ticket Types for " + eventName,
          buttons: [
            {
              type: "web_url",
              url: backend_server,
              title: "VVIP (60000)"
            },
            {
              type: "web_url",
              url: backend_server,
              title: "Super VIP (520000)"
            }
          ]
        }
      }
    }
  };
  callback(messageData);
};
