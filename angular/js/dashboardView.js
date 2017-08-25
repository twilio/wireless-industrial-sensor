var dashboardView = {
  templateUrl: require("../views/dashboard.html"),

  init: function (app, $scope) {
    $scope.sensors = app.sensors;
    $scope.noSensor = function () { return Object.keys(app.sensors).length === 0; }
  }
};

module.exports = dashboardView;
