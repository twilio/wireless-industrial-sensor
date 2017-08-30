const Chartist = require('chartist');
const moment = require('moment');

var dashboardView = {
  templateUrl: require("../views/dashboard.html"),
  init: function (app, $scope) {
    $scope.sensors = app.sensors;
    $scope.noSensor = function () { return Object.keys(app.sensors).length === 0; }
    $scope.updateCharts = function () {
      $scope.temperatureChart.update({ series: [app.series.temperature] });
      $scope.humidityChart.update({ series: [app.series.humidity] });
      $scope.weightChart.update({ series: [app.series.weight] });
    };
    $scope.initCharts = function() {
      let data = { series: [{name: 'ticks', data: []}] };
      let options = {
          width: 300,
          height: 200,
          axisX: {
            type: Chartist.FixedScaleAxis,
            divisor: 5,
            labelInterpolationFnc: function(value) {
              return moment(value).format('HH:mm');
            }
          }
        };
        $scope.temperatureChart = new Chartist.Line('#chart-temperature', data, options);
        $scope.humidityChart = new Chartist.Line('#chart-humidity', data, options);
        $scope.weightChart = new Chartist.Line('#chart-weight', data, options);
        if (app.series !== undefined) {
          $scope.updateCharts(app.series);
        }
    }
  }
};

module.exports = dashboardView;
