#include "HX711ADC/HX711ADC.h"
#include "Si7020/Si7020.h"
#include "HttpClient/HttpClient.h"
#include "cellular_hal.h"

// We need to use the Twilio APN
STARTUP(cellular_credentials_set("wireless.twilio.com", "", "", NULL));

HX711ADC beans(C4, C5);
Si7020 sensor;

TCPClient client;

// this value is obtained by calibrating the scale with known weights; https://learn.sparkfun.com/tutorials/load-cell-amplifier-hx711-breakout-hookup-guide
float calibration_factor = 1500;

HttpClient http;
const char * device_name = "CounterName";
const char * device_token = "xxxx";
const char * server_host = "http://xxxx.localtunnel.me";
const int server_port = 8000;
const char * server_path = "/api/data/";

// Headers need to be set at init.
http_header_t headers[] = {
  { "Content-Type", "application/json" },
  { "Accept" , "*/*"},
  { NULL, NULL } // NOTE: Always terminate headers will NULL
};

http_request_t request;
http_response_t response;

void setup() {
  //Initialise our temperature sensor
  sensor.begin();

  //Initilialise the HX711 ADC for our load cell
  beans.set_scale(calibration_factor);
  // reset the scale to 0
  beans.tare();

  Serial.begin(9600);
}

void loop() {
  // Measure Weight average over 10 samples (in ozs)
  int weight = beans.get_units(10);

  // Measure Relative Humidity
  float rh = sensor.getRH();

  // Measure Temperature + convert from C to F
  float t = sensor.getTemp();
  t = (t * 1.8)+32;

  // setup request
  request.hostname = server_host;
  request.port = server_port;
  request.path = server_path;

  char buffer[200];
  sprintf(buffer, "{\"device_name\":\"%s\", \"weight\": %d, \"humidity\": %f, \"temp\": %f, \"token\": \"%s\"}", device_name, weight, rh, t, device_token);
  request.body = buffer;
  Serial.println(request.body);

  // POST data
  http.post(request, response, headers);

  // put the ADC in sleep mode
  beans.power_down();
  delay(1000);
  beans.power_up();
}

