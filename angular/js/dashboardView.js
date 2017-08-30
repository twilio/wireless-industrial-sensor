const Chartist = require('chartist');
const moment = require('moment');

var dashboardView = {
  templateUrl: require("../views/dashboard.html"),
  init: function (app, $scope) {
    $scope.sensors = app.sensors;
    $scope.noSensor = function () { return Object.keys(app.sensors).length === 0; }
    $scope.updateCharts = function (series) {
      if (!$scope.temperatureChart) initCharts ($scope);

      $scope.temperatureChart.update({ series: [series.temperature] });
      $scope.humidityChart.update({ series: [series.humidity] });
      $scope.weightChart.update({ series: [series.weight] });
    };
  }
};

function initCharts ($scope) {
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
}  

module.exports = dashboardView;
