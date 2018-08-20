exports.getEDMJSON = function(server_url) {
  return [
    {
      title: "EDM",
      subtitle: "Full Moon Party",
      item_url: "https://www.oculus.com/en-us/rift/",
      image_url:
        "https://images.unsplash.com/photo-1531336542000-a8259492b550?ixlib=rb-0.3.5&ixid=eyJhcHBfaWQiOjEyMDd9&s=82e2bb59793ac56f5e5c681531f57407&auto=format&fit=crop&w=800&q=60",
      buttons: [
        {
          type: "postback",
          title: "Show me the ticket type",
          payload: "buyevent1"
        }
      ]
    },
    {
      title: "Water Festival",
      subtitle: "JUMP JUMP",
      item_url: "https://www.oculus.com/en-us/touch/",
      image_url:
        "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?ixlib=rb-0.3.5&ixid=eyJhcHBfaWQiOjEyMDd9&s=be465b88fdf21a6e05ab522458452344&auto=format&fit=crop&w=800&q=60",
      buttons: [
        {
          type: "postback",
          title: "Show me the ticket type",
          payload: "buyevent2"
        }
      ]
    }
  ];
};
