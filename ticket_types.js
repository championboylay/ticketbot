exports.showTicketsByEvent = function(
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
              title: "GA (30000)"
            },
            {
              type: "web_url",
              url: backend_server,
              title: "PGA (50000)"
            },
            {
              type: "web_url",
              url: backend_server,
              title: "VIP (10000)"
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
