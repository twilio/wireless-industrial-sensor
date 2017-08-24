#include "Si7020/Si7020.h"
#include "ThingSpeak/ThingSpeak.h"
#include "HX711ADC/HX711ADC.h"
#include "cellular_hal.h"

//We need to use the Twilio APN
STARTUP(cellular_credentials_set("wireless.twilio.com", "", "", NULL));

HX711ADC beans(C4, C5);
Si7020 sensor;

TCPClient client;
unsigned long myChannelNumber = 101;            //Place your Thingspeak Channel Number Here
const char * myWriteAPIKey = "YourThingspeakAPIKey";

float calibration_factor = 6350;            // this value is obtained by calibrating the scale with known weights; https://learn.sparkfun.com/tutorials/load-cell-amplifier-hx711-breakout-hookup-guide

void setup() {

    //Initialise our ThingSpeak channel
    ThingSpeak.begin(client);

    //Initialise our temperature sensor
    sensor.begin();

    //Initilialise the HX711 ADC for our load cell
    beans.set_scale(calibration_factor);
    beans.tare();                    // reset the scale to 0

}

void loop() {

    // Measure Weight
    int weight = beans.get_units(10);       //Average over 10 samples (in ozs)

    // Measure Relative Humidity
    float rh = sensor.getRH();

    // Measure Temperature
    float t = sensor.getTemp();
    t = (t * 1.8)+32;                       //Convert from C to F

    // Set our channel fields with our data
    ThingSpeak.setField(1,weight);
    ThingSpeak.setField(2,t);
    ThingSpeak.setField(3,rh);

    // Write the fields that we've set all at once.
    ThingSpeak.writeFields(myChannelNumber, myWriteAPIKey);

    beans.power_down();                 // put the ADC in sleep mode
    delay(10000);                           // ThingSpeak will only accept updates every 15 seconds so make sure we wait at least this length of time - Note: Include the time taken to average the load cell values
    beans.power_up();
}

