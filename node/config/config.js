module.exports = function() {
  var config;
  config = {
    "sqlite3" : "./config/bean_counter.sqlite",
    "twilio": {
      "account_sid": "xxxx",
      "auth_token":  "xxxx"
    }
  }
  return config;
}();
