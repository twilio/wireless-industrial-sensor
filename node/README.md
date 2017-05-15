# Industrial Sensor
### Build A Realtime Coffee Inventory Tracking
##### A partner Blueprint for [Particle Electron](https://www.particle.io)


## Getting Started
### Installation
In order to get your custom backend up and running you will need a few things installed on your computer.

**NodeJS**: Node can be downloaded and installed from https://nodejs.org/en/. If you are installing on linux via a package manager. Instructions can be found at https://nodejs.org/en/download/package-manager/

**Localtunnel**: In order to run the Industrial Sensor server locally you will need to open up a port on your computer. The easiest way to do that is with Localtunnel. Instructions for installation can be found here https://localtunnel.github.io/www/

****

### Setup

**Configuration**: The Industrial Sensor server talks to the twilio API and our SQLite database. We need to set the correct values for each in our config/config.js file.

The sqlite3 config value should only need to be changed if you want to change the location of your saved database file.

The Twilio config values will need to be updated with your Account SID and your account Auth Token from the [Twilio dashboard](https://www.twilio.com/console).

    "twilio": {
      "account_sid": "xxxx",
      "auth_token": "xxxx"
     }

**NPM Packages**: To install all the needed node packages change directory to the Industrial Sensor node directory and install.

    npm install

****

### Running the Server

Now that all setup is complete it's time to run the server. Make sure that you are in the node directory, and run:

	npm start

This will start the server on your computer on port 8000. http://localhost:8000

****

### Connecting the Industrial Sensor to the server

Now that your server is running you'll need to make sure that the Industrial Sensor can connect and send it's data.

**Adding the Industrial Sensor**: First we'll need to add the Industrial Sensor to your database. This can be done from the web interface.

1. Go to [your server](http://localhost:8000)
* Click the "Add Industrial Sensor" link at the top.
* Click the "Add New Industrial Sensor" button to show the device form.
* Enter all device information and click submit. **Note**: Twilio SID is your sim card SID and can be found in your [Twilio dashboard](https://www.twilio.com/console).

**Start localtunnel and add the URL to electron**: In order to get the Industrial Sensor to talk to your local server we need to install and start localtunnel which will open up your server for requests.

1. install localtunnel
2. start localtunnel on port 8000
3. Copy URL generated for use in the next step

		npm install -g localtunnel
		lt --port 8000
    	your url is: http://xxxx.localtunnel.me

**Add server info to your Industrial Sensor code**: After creating the Industrial Sensor on the server you will see a new entry on the "devices" page. You will need to add the name and token to your [electon code](../electron/electron_custom.ino). The name and token can be entered on lines 18 and 19 respectively.

	const char * device_name  = "CounterName";
	const char * device_token = "xxxx";

You will also need to add your localtunnel information in the electron code. Add the URL generated from localtunnel in the previous step into your electron code at line 20.

	const char * server_host = "http://xxxx.localtunnel.me";


After installing the code changes onto the electron you should start seeing data come through on the front page of [your server](http://localhost:8000)

****

### Custom Backend Features

**Dashboard Page**: Lists all Industrial Sensor and live-updates all three stats from the device (weight, temp, humidity).

**Single Device Page**: Contains Industrial Sensor stat charts and additional Industrial Sensor information including.

* Data averages over the past hour
* Twilio device status
* Twilio device URL for easy access
* Twilio data usage and pricing for the past month (data and commands)
* Map to Industrial Sensor's location
* Edit tracker data

**Add Industrial Sensor page**: Allows the user to add new Industrial Sensor and shows a table of all the Industrial Sensor in the system and their information.