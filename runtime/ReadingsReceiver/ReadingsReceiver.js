const crypto = require ('crypto');
const AccessToken = Twilio.jwt.AccessToken;
const SyncGrant = AccessToken.SyncGrant;

function sensorAuth (sensors, sensor_id, sensor_token) {
  if (!(sensor_id in sensors)) return false;
  let hash = crypto.createHash ('sha512').update (sensor_token).digest ('hex');
  return hash === sensors[sensor_id].hash;
}

exports.handler = function (context, event, callback) {
  if (!event.data) return callback (null, {success: false, error: 'no data defined in event'});
  event.data = JSON.parse (event.data);

  let sensor = {
    id: event.data.id,
    name: event.data.name,
    weight: event.data.weight,
    humidity: event.data.humidity,
    temperature: event.data.temperature,
    token: event.data.token,
  };

  // Create a "grant" which enables a client to use Sync as a given user,
  // on a given device
  let syncGrant = new SyncGrant ({
    serviceSid: context.INDUSTRIAL_SENSOR_SERVICE_SID,
  });

  // Create an access token which we will sign and return to the client,
  // containing the grant we just created
  let token = new AccessToken (
    context.ACCOUNT_SID,
    context.INDUSTRIAL_SENSOR_API_KEY,
    context.INDUSTRIAL_SENSOR_API_SECRET,
    {
      ttl: parseInt (context.INDUSTRIAL_SENSOR_TOKEN_TTL), // int and string are different for AccessToken
    }
  );

  token.addGrant (syncGrant);
  token.identity = sensor.id;

  // Verify sensor token
  let client = context.getTwilioClient ();
  let syncService = client.sync.services (context.INDUSTRIAL_SENSOR_SERVICE_SID);

  syncService
    .documents ('app.configuration')
    .fetch ()
    .then (function (configDocument) {
      let config = configDocument.data;
      let item = 'sensors.' + sensor.id + '.data';
      if (sensorAuth (config.sensors, sensor.id, sensor.token)) {
        syncService.syncMaps ('sensorReadings').syncMapItems (item).update ({
          data: {
            temperature: sensor.temperature,
            humidity: sensor.humidity,
            weight: sensor.weight,
          },
        });
      } else {
        // Unauthorized sensor, does not exist.
        console.log ('Unauthorized sensor, does not exist.');
      }
    })
    .catch (function (error) {
      console.log ('Sync service error: ' + error);
      callback (null, {success: false, error: 'Sync service error: ' + error});
    });
};
