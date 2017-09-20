'use strict';
const APP_CONFIGURATION_DOCUMENT_NAME = 'app.configuration';
const SENSOR_DATA_READINGS = 'sensorReadings';

function SENSOR_DATA_MAP_NAME (sensorId) {
  return 'sensors.' + sensorId + '.data';
}

module.exports = function (callbacks) {
  const $ = require ('jquery');
  const crypto = require ('crypto');
  const SyncClient = require ('twilio-sync').Client;
  const moment = require ('moment');

  var syncClient;
  var token;
  var auth = 'username=twilio&pincode=928462';
  var configDocument;

  var sensors = {};

  function randomString (len) {
    var charSet =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var randomString = '';
    for (var i = 0; i < len; i++) {
      var randomPoz = Math.floor (Math.random () * charSet.length);
      randomString += charSet.substring (randomPoz, randomPoz + 1);
    }
    return randomString;
  }

  function loadSensors () {
    var invalidSensors = [];

    for (var sensorId in configDocument.value.sensors) {
      var sensor = configDocument.value.sensors[sensorId];
      if (
        sensor.id === sensorId &&
        typeof sensor.name === 'string' &&
        typeof sensor.twilio_sim_sid === 'string'
      ) {
        if (sensorId in sensors) {
          if (
            sensor.name !== sensors[sensorId].info.name ||
            sensor.twilio_sim_sid !== sensors[sensorId].info.twilio_sim_sid
          ) {
            console.log ('Updating sensor', sensor);
            sensors[sensorId].info = sensor;
          }
        } else {
          console.log ('Loading new sensor', sensor);
          sensors[sensorId] = {
            info: sensor,
          };
        }

        // Subscribe to map update events
        fetchReadings (sensor);
      } else {
        console.warn (
          'Invalid sensor configuration, removing from the list: ',
          sensorId,
          sensor
        );
        invalidSensors.push (sensorId);
      }
    }
    for (var sensorId in sensors) {
      if (!(sensorId in configDocument.value.sensors)) {
        console.log ('Deleting sensor listenor', sensors[sensorId]);

        if (sensors[sensorId].readingsMap) {
          sensors[sensorId].readingsMap.removeAllListeners ('itemUpdated');
        }

        delete sensors[sensorId];
      }
    }
    return invalidSensors;
  }

  function fetchReadings (sensor) {
    syncClient.map (SENSOR_DATA_READINGS).then (function (map) {
      map.get (SENSOR_DATA_MAP_NAME (sensor.id)).then (function (item) {
        var cSensor = sensors[sensor.id];
        cSensor.readingsMap = item;
        cSensor.readings = item.value;
        updateSeries(cSensor, item);
        callbacks.updateCharts (cSensor.series);
      });
      map.on ('itemUpdated', function (data) {
        var cSensor = sensors[sensor.id];
        cSensor.readings = data.value;
        updateSeries(cSensor, data);
        callbacks.updateCharts (cSensor.series);
      });
    });
  }

  function updateSeries(sensor, data) {
    if (!sensor.series) sensor.series = { temperature: [], humidity: [], weight: [] };
    
    var now = new Date();
    var weight = data.value.weight < 0 ? 0 : data.value.weight;

    sensor.series.temperature.push({x: now, y: data.value.temperature});
    sensor.series.humidity.push({x: now, y: data.value.humidity});
    sensor.series.weight.push({x: now, y: weight});
  }

  function sensorInfoCheck (sensor, callback) {
    if (!sensor.id || !sensor.id.match (/^[a-zA-Z0-9]+$/)) {
      callback ('sensor id is invalid: ' + sensor.id);
      return false;
    }
    if (!sensor.name) {
      callback ('sensor name is not specified');
      return false;
    }
    if (
      !sensor.twilio_sim_sid ||
      !sensor.twilio_sim_sid.match (/^DE[a-z0-9]{32}$/)
    ) {
      callback ('sensor sim SID is invalid: ' + sensor.twilio_sim_sid);
      return false;
    }
    return true;
  }

  function genToken () {
    var token = randomString (16);
    var hash = crypto.createHash ('sha512').update (token).digest ('hex');
    return {
      token: token,
      hash: hash,
    };
  }

  return {
    initialized: $.Deferred (),

    sensors: sensors,

    updateToken: function (cb) {
      var that = this;
      return $.get ('/userauthenticate?' + auth, function (result) {
        if (result.success) {
          console.log ('token updated:', result);
          token = result.token;
          if (syncClient) {
            syncClient.updateToken (token);
          } else {
            syncClient = new SyncClient (token);
          }
          if (cb) cb (token);
          setTimeout (that.updateToken.bind (that), result.ttl * 1000 * 0.96); // update token slightly in adance of ttl
        } else {
          console.error ('failed to authenticate the user: ', result.error);
        }
      }).fail (function (jqXHR, textStatus, error) {
        console.error (
          'failed to send authentication request:',
          textStatus,
          error
        );
        setTimeout (that.updateToken.bind (that), 10000); // retry in 10 seconds
      });
    },

    fetchConfiguration: function () {
      return syncClient
        .document (APP_CONFIGURATION_DOCUMENT_NAME)
        .then (function (doc) {
          configDocument = doc;
          var newDoc = null;
          var invalidSensors;

          if (doc.value.sensors) {
            invalidSensors = loadSensors ();
            if (invalidSensors.length) {
              if (newDoc === null) newDoc = $.extend (true, doc.value, {});
              invalidSensors.forEach (function (idOfInvalidSensor) {
                delete newDoc.sensors[idOfInvalidSensor];
              });
            }
          } else {
            console.warn ('sensors is not configured, creating an empty list');
            if (null === newDoc) newDoc = $.extend (true, doc.value, {});
            newDoc.sensors = {};
          }
          return newDoc;
        })
        .then (function (newDoc) {
          if (newDoc !== null) {
            return Promise.all ([
              syncClient.map (SENSOR_DATA_READINGS).then (function (map) {
                map.set ('sensors', {}).then (function (item) {
                  console.log ('dataReadings map created');
                });
              }),
              configDocument.set (newDoc).then (function () {
                console.log (
                  'app configuration updated with new value:',
                  newDoc
                );
              }),
            ]);
          }
        });
    },

    addSensor: function (newSensor, callback) {
      if (!sensorInfoCheck (newSensor, callback)) return;
      if (newSensor.id in configDocument.value.sensors)
        return callback ('Sensor with the same ID exists');
      newSensor.created_at = new Date ().getTime ();

      var t = genToken ();
      newSensor.hash = t.hash;

      configDocument
        .mutate (function (remoteData) {
          if (!remoteData.sensors) remoteData.sensors = {};
          remoteData.sensors[newSensor.id] = newSensor;
          return remoteData;
        })
        .then (function () {
          // create necessary objects
          return Promise.all ([
            syncClient.map (SENSOR_DATA_READINGS).then (function (map) {
              console.log (map);
              return Promise.all[
                map.set (SENSOR_DATA_MAP_NAME (newSensor.id), {
                  humidity: -1,
                  temperature: -1,
                  weight: -1,
                })
              ];
            }),
          ]);
        })
        .then (function () {
          loadSensors ();
          // make token temporarily visible
          callback (
            null,
            $.extend (true, sensors[newSensor.id].info, {
              token: t.token,
            })
          );
          callbacks.refresh ();
        })
        .catch (function (err) {
          callback (err);
        });
    },

    updateSensor: function (updatedSensor, callback) {
      configDocument
        .mutate (function (remoteData) {
          if (updatedSensor.id in remoteData.sensors) {
            remoteData.sensors[
              updatedSensor.id
            ] = $.extend (true, updatedSensor, {
              hash: remoteData.sensors[updatedSensor.id].hash,
            });
          } else {
            callback ('Sensor is not in the list');
          }
          return remoteData;
        })
        .then (function () {
          loadSensors ();
          callback (null);
          callbacks.refresh ();
        })
        .catch (function (err) {
          callback (err);
        });
    },

    regenToken: function (sensorId, callback) {
      var t = genToken ();
      configDocument
        .mutate (function (remoteData) {
          if (sensorId in remoteData.sensors) {
            remoteData.sensors[sensorId].hash = t.hash;
          } else {
            throw 'unknown sensor: ' + sensorId;
          }
          return remoteData;
        })
        .then (function () {
          loadSensors ();
          // make token temporarily visible
          callback (
            $.extend (true, sensors[sensorId].info, {
              token: t.token,
            })
          );
          callbacks.refresh ();
        })
        .catch (function (err) {
          // ignore error
          console.error ('regenToken', err);
        });
    },

    deleteSensor: function (sensorId) {
      configDocument
        .mutate (function (remoteData) {
          delete remoteData.sensors[sensorId];
          return remoteData;
        })
        .then (function () {
          loadSensors ();
          callbacks.refresh ();
        })
        .then (function () {
          syncClient.map (SENSOR_DATA_READINGS).then (function (map) {
            map.remove (SENSOR_DATA_MAP_NAME (sensorId)).then (function () {
              console.log ('Deleted sensor ', SENSOR_DATA_MAP_NAME (sensorId));
            });
          });
        });
    },

    init: function () {
      var that = this;
      this.updateToken (function (token) {
        that
          .fetchConfiguration ()
          .then (function () {
            callbacks.refresh ();
          })
          .then (function () {
            that.initialized.resolve ();
          });
      });
    },
  };
};
