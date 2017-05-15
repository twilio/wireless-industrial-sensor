var Main = function() {
	return {
    all_charts: {},
    init: function (data) {
      Main.initSockets();

      $('.add-device-show').click(function() {
        $(this).hide();
        $('.add-device').fadeIn(333);
      });
      $('.add-device-cancel').click(function() {
        $('.add-device').hide();
        $('.add-device-show').fadeIn(333);
      });

    },
    initMoreInfo: function(device_id, chart_data) {

      Main.populateCharts(device_id, chart_data);

      $('.edit-device-scroll').click(function() {
        $("html, body").animate({ scrollTop: $(document).height() }, 1000);
      });

      var map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: 44.540, lng: -78.546 },
        zoom: 14
      });

      var address = $('#map').data('address');
      if(address) {
        var geocoder = new google.maps.Geocoder();
        geocoder.geocode( { 'address': address}, function(results, status) {
          if (status == 'OK') {
            map.setCenter(results[0].geometry.location);
            var marker = new google.maps.Marker({
                map: map,
                position: results[0].geometry.location
            });
          } else {
            alert('Geocode was not successful for the following reason: ' + status);
          }
        });
      }
    },
    initDashboardCharts: function(devices, data) {

      for(var i=0; i<data.length; i++) {
        Main.populateCharts(devices[i].id, data[i]);
      }
    },
    populateCharts: function(device_id, chart_data) {
      var options = {
        legend: {
          display: false
        },
        scales: {
          xAxes: [{
            type: 'time',
            time: {
              unit: 'minute',
              displayFormats: {
                minute: 'h:mm'
              }
            },
            position: 'bottom'
          }]
        }
      };

      var general_data = {
        datasets: [{
          data: [],
          backgroundColor: [
            'rgba(255, 255, 255, .2)',
          ],
          borderColor: [
            'rgba(255, 255, 255, 1.0)',

          ],
          borderWidth: 2
        }]
      };

      general_data.datasets[0].data = chart_data.weight.reverse();
      var weight_chart = new Chart($('#weight-device-'+device_id), {
        type: 'line',
        data: $.extend(true, {}, general_data),
        options: options
      });

      general_data.datasets[0].data = chart_data.temp.reverse();
      var temp_chart = new Chart($('#temp-device-'+device_id), {
        type: 'line',
        data: $.extend(true, {}, general_data),
        options: options
      });

      general_data.datasets[0].data = chart_data.humidity.reverse();
      var humidity_chart = new Chart($('#humidity-device-'+device_id), {
        type: 'line',
        data: $.extend(true, {}, general_data),
        options: options
      });

      console.log("device"+device_id);
      Main.all_charts["device"+device_id] = {
        "weight_chart": weight_chart,
        "temp_chart": temp_chart,
        "humidity_chart": humidity_chart
      }
    },
  	initSockets: function () {
      Main.socket = io.connect('/beans');
      Main.socket.on("connect", function(){});

      Main.socket.on("new:bean-data", function(data) {
        console.log("device"+data.device_id);
        Main.all_charts["device"+data.device_id].weight_chart.data.datasets[0].data.push(data.weight);
        Main.all_charts["device"+data.device_id].temp_chart.data.datasets[0].data.push(data.temp);
        Main.all_charts["device"+data.device_id].humidity_chart.data.datasets[0].data.push(data.humidity);

        Main.all_charts["device"+data.device_id].weight_chart.update();
        Main.all_charts["device"+data.device_id].temp_chart.update();
        Main.all_charts["device"+data.device_id].humidity_chart.update();

        if(Main.all_charts["device"+data.device_id].weight_chart.data.datasets[0].data.length > 30) {
          Main.all_charts["device"+data.device_id].weight_chart.data.datasets[0].data.splice(0, 1);
          Main.all_charts["device"+data.device_id].temp_chart.data.datasets[0].data.splice(0, 1);
          Main.all_charts["device"+data.device_id].humidity_chart.data.datasets[0].data.splice(0, 1);
        }

        Main.all_charts["device"+data.device_id].weight_chart.update();
        Main.all_charts["device"+data.device_id].temp_chart.update();
        Main.all_charts["device"+data.device_id].humidity_chart.update();
      });
    }

	};
}();