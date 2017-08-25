#include <Si7020.h>
#include <HX711ADC.h>
#include "Si7020/Si7020.h"

// We need to use the Twilio APN
STARTUP(cellular_credentials_set("wireless.twilio.com", "", "", NULL));

HX711ADC cells(C4, C5);
Si7020 sensor;

// this value is obtained by calibrating the scale with known weights; 
// https://learn.sparkfun.com/tutorials/load-cell-amplifier-hx711-breakout-hookup-guide
float calibration_factor = 1500;

const char * id = "One";
const char * name = "MyIndustrialSensor";
const char * token = "2TZNkmwiQcy8E5Jl";

void setup() {
  // Initialize our temperature sensor
  sensor.begin();

  // Initilialize the HX711 ADC for our load cell
  cells.set_scale(calibration_factor);
  // Reset the scale to 0
  cells.tare();

  Serial.begin(9600);
}

void loop() {
  // Measure Weight average over 10 samples (in ozs)
  int weight = cells.get_units(10);

  // Measure Relative Humidity
  double rh = sensor.getRH();

  // Measure Temperature + convert from C to F
  double t = sensor.getTemp();
  t = (t * 1.8) + 32;

  // Send data to Particle server
  // Using publish so listeners can respond accordingly
  char data[200];
  sprintf(data, "{\"id\":\"%s\", \"name\":\"%s\", \"weight\": %d, \"humidity\": %f, \"temperature\": %f, \"token\": \"%s\"}", id, name, weight, rh, t, token);

  Particle.publish("Industrial Sensor Measurement", data, PRIVATE);

  // Put the ADC in sleep mode
  cells.power_down();
  delay(60000);
  cells.power_up();
}