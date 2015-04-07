var db = require('../db');
var path = require('path');
var fs = require('fs');
var brain = require('brain');

//TODO: SOLUTION CODE BELOW
var net = new brain.NeuralNetwork({
  hiddenLayers:[200], //Use the docs to explore various numbers you might want to use here
  learningRate:0.3
});
/*
TODO:
investigate whether the delinquency days are an input or an output
create my own metrics for the inputs, such as income coverage ratio
*/

module.exports = {
  startNet: function(req,res) {
    db.query('SELECT * FROM training', function(err, response) {
      if(err) {
        console.error(err);
      } else {
        var formattedData = module.exports.formatData(response);
        var training = [];
        var testing = [];
        for(var i = 0; i < formattedData.length; i++) {
          //separate our data into a randomly selected training set (80% of the data)
          if(Math.random() > .8) {
            testing.push(formattedData[i]);
          } else {
          //and a test set which we will use to test our trained net (20% of the data)
            training.push(formattedData[i]);
          }
        }
        console.log('training.length');
        console.log(training.length);
        console.log('testing.length');
        console.log(testing.length);
        res.send('Off to train the brain!\n');
        module.exports.trainBrain(training, testing);
      }
    });
  },

  loadAndTestBrain: function(req,res) {
    db.query('SELECT * FROM training', function(err, response) {
      if(err) {
        console.error(err);
      } else {
        var formattedData = module.exports.formatData(response);
        //TODO: add in a query parameter that includes the filename, and parse that from the path
        fs.readFile('name', 'utf8', function(err, data) {
          if(err) {
            console.error(err);
          } else {
            net.fromJSON(JSON.parse(data));
            //TODO: send off a response
            //TODO: investigate separating out a training and a testing table
            module.exports.testBrain(formattedData);
          }
        });

      }
    });
  },

  trainBrain: function(trainingData, testingData) {
    console.time('trainBrain');
    console.log('training your very own Brain');

    //TODO: SOLUTION CODE BELOW
    net.train(trainingData,{
      errorThresh: 0.05,  // error threshold to reach
      iterations: 10,   // maximum training iterations
      log: true,           // console.log() progress periodically
      logPeriod: 1,       // number of iterations between logging
      learningRate: 0.3    // learning rate
    });

    var jsonBackup = net.toJSON();
    var runBackup = net.toFunction();

    module.exports.writeBrain(jsonBackup);

    console.timeEnd('trainBrain');

    module.exports.testBrain(testingData);
  },

  //Test our brain with a given set of testData
  //Logs the output of default rate at that prediction level
  testBrain: function(testData) {
    console.time('testBrain');
    var results = {};
    for(var j = 0; j <=100; j++) {
      results[j] = {
        nnCount: 0,
        defaulted: 0
      };
    }

    for(var i = 0; i < testData.length; i++) {
      testData[i].nnPredictions = net.run(testData[i].input);
    }
    console.log(testData[0]);

    for(var j = 0; j < testData.length; j++) {
      //net.run gives us the net's prediction for that particular input
      //TODO: SOLUTION CODE BELOW. Consider refactoring outside of for statement.
      // var rawPrediction = net.run(testData[j].input);
      //we then format the net's prediction to be a number between 0 and 100
      var prediction = Math.round( testData[j].nnPredictions.defaulted * 100);
      //We then increment the total number of cases that the net predicts exist at this level
      results[prediction].nnCount++;
      //And whether this input resulted in a default or not
      results[prediction].defaulted += testData[j].output.defaulted;
    }

    //yeah, i know we don't like to assume the keys are going to be ordered, but it's a time-saving shortcut to make at the moment.
    for(var key in results) {
      console.log(key + '- nnCount: ' + results[key].nnCount + ' defaulted: ' + results[key].defaulted + ' Default Rate: ' + results[key].defaulted/results[key].nnCount);
    }
    console.timeEnd('testBrain');

    console.log(results);
  },

  //Writes the neural net to a file for backup
  writeBrain: function(json) {
    var fileName = 'hiddenLayers' + net.hiddenLayers + 'learningRate' + net.learningRate + new Date().getTime();
    fs.writeFile(fileName, json, function(err) {
      if(err) {
        console.error('sad, did not write to file');
      } else {
        console.log('wrote to file',fileName);
      }
    });
  },

  //Takes our raw data input, roughly normalizes it, and transforms it into numbers between 0 and 1 like our net expects
  formatData: function(data) {

    //TODO: refactor to use prettier names in the db

    //TODO: SOLUTION CODE BELOW
    console.log('formatting Data');
    var formattedResults = [];
    for(var i = 0; i < data.length; i++) {
      var item = data[i];

      var obs = {};
      obs.input = {};
      obs.output = {
        defaulted: item.seriousDlqin2yrs
      };

      //if the utilization rate is below 1, we divide it by 3 to make it smaller (taking the cube root would make it larger);
      if(item.revolvingUtilizationOfUnsecuredLines < 1) {
        obs.input.utilizationRate = item.revolvingUtilizationOfUnsecuredLines/3;
      } else {
        //otherwise we take the cube root of it, and then divide by 37 (which is the max number we would have after cube rooting ).
        obs.input.utilizationRate = Math.pow(item, 1/3)/37;
      }

      obs.input.age = item.age/109;
      obs.input.thirtyDaysLate = item.NumberOfTime30To59DaysPastDueNotWorse/98;
      obs.input.monthlyIncome = Math.sqrt(item.MonthlyIncome)/1735;
      obs.input.openCreditLines = Math.sqrt(item.NumberOfOpenCreditLinesAndLoans)/8;

      obs.input.ninetyDaysLate = Math.sqrt(item.NumberOfTimes90DaysLate)/10;

      obs.input.realEstateLines = item.NumberRealEstateLoansOrLines/54;

      obs.input.sixtyDaysLate = Math.sqrt(item.NumberOfTime60To89DaysPastDueNotWorse)/10;

      obs.input.numDependents = Math.sqrt(item.NumberOfDependents)/5;

      formattedResults.push(obs);
      // if( i % (Math.round(data.length/10)) === 0 ) {
      //   console.log(data[i]);
      //   console.log('returns to us');
      //   console.log(obs);
      // }
    }
    console.log('formatted data');
    return formattedResults;

  }
};
