var $ = require("jquery");

var sensorListView = {
  templateUrl: require("../views/sensor_list.html"),

  init: function (app, $scope) {
    $scope.sensors = app.sensors;
    $scope.newSensor = {};
    $scope.addSensor = function () {
      app.addSensor(angular.copy($scope.newSensor), function (err, sensorAdded) {
        if (err) {
          $('#add-sensor-failed').text(JSON.stringify(err));          
        } else {
          $scope.editedSensorInfo = sensorAdded;
          $('.add-sensor').hide();
          $('.add-sensor-show').fadeIn(333);          
          $scope.$apply();
        }
      });
    };
    $scope.editSensor = function (sensorId) {
      $scope.editedSensorInfo = app.sensors[sensorId].info;
      $('.edit-sensor').fadeIn(333);
    };
    $scope.updateSensor = function () {
      app.updateSensor(angular.copy($scope.editedSensorInfo), function (err) {
        if (err) {
          $('#edit-sensor-failed').text(JSON.stringify(err));          
        } else {
          $('.edit-sensor').hide();
          $scope.$apply();
        }
      });
    };
    $scope.deleteSensor = function (sensorId) {
      app.deleteSensor(sensorId);
    };
    $scope.regenTokenForSensor = function (sensorId) {
      app.regenToken(sensorId, function (sensorUpdated) {
        $scope.editedSensorInfo = sensorUpdated;
      });
    };

    $('.add-sensor-show').click(function() {
      $(this).hide();
      $('.add-sensor').fadeIn(333);
    });
    $('.add-sensor-cancel').click(function() {
      $('.add-sensor').hide();
      $('.add-sensor-show').fadeIn(333);
    });

    $('.edit-sensor-cancel').click(function() {
      $scope.editedSensorInfo = null;
      $('.edit-sensor').hide();
      $scope.$apply();
    });
  },
};

module.exports = sensorListView;
