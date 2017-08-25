const crypto = require("crypto");
const AccessToken = Twilio.jwt.AccessToken;
const SyncGrant = AccessToken.SyncGrant;

function sensorAuth(sensors, sensor_id, sensor_token) {
    if (!(device_id in devices)) return false;
    let hash = crypto.createHash('sha512').update(sensor_token).digest("hex");
    return hash === sensors[sensor_id].hash;
}

exports.handler = function(context, event, callback) {
    if (!event.data) return callback(null, { success: false, error: "no data defined in event" });

    let sensor = {
        id: event.data.id,
        name: event.data.name,
        weight: event.data.weight,
        humidity: event.data.humidity,
        temperature: event.data.temperature
    };

    // Create a "grant" which enables a client to use Sync as a given user,
    // on a given device
    let syncGrant = new SyncGrant({
        serviceSid: context.INDUSTRIAL_SENSOR_SERVICE_SID
    });

    // Create an access token which we will sign and return to the client,
    // containing the grant we just created
    let token = new AccessToken(
        context.ACCOUNT_SID,
        context.INDUSTRIAL_SENSOR_API_KEY,
        context.INDUSTRIAL_SENSOR_API_SECRET, {
            ttl : parseInt(context.INDUSTRIAL_SENSOR_TOKEN_TTL) // int and string are different for AccessToken
        }
    );

    token.addGrant(syncGrant);
    token.identity = sensor.id;

    // verify sensor token
    let client = context.getTwilioClient();
    let syncService = client.sync.services(context.INDUSTRIAL_SENSOR_SERVICE_SID);

    syncService.documents("app.configuration").fetch()
        .then(function (configDocument) {
            let config = configDocument.data;
            console.log('inc');
            console.log(config);
            if (sensorAuth(config.sensors, sensor.id, sensor.token)) {
            // Serialize the token to a JWT string and include it in a JSON response

        } else {
            // Sensor does not exist, create.
            console.log("Creating sensor with id: " + sensor.id);
            // configDocument.set({              
            //     success: true,
            //     sensor_id: sensor.id,
            //     service_sid: context.INDUSTRIAL_SENSOR_SERVICE_SID,
            //     ttl: context.INDUSTRIAL_SENSOR_TOKEN_TTL,
            //     token: token.toJwt(),
            //     sync_objects: {
            //         sensor_measurement_list: "sensor." + sensor.id + ".measurement",
            //     }
            // });
        }
    })
    .catch(function (error) {
        console.log("Sync service error: " + error);
        callback(null, { success: false, error: "Sync service error: " + error });
    });
};