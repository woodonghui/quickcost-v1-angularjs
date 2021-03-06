var app = angular.module('App', ['lbServices', 'blockUI']);

app.controller('loginController', function ($scope, $http, User) {
  $scope.username;
  $scope.password;

  $scope.login = function () {
    User.login({
        username: $scope.username,
        password: $scope.password
      })
      .$promise.then(function (user) {
        window.location.href = '/admin.html';
      }, function (fail) {
        alert('用户名和密码错误!');
      });
  }

  $scope.logout = function () {
    User.logout().$promise.then(function () {
      console.log('you are logged out.');
    });

  }
});

app.controller('outletController', function ($scope, $http, Outlet) {

  $scope.outlets = Outlet.find();
  $scope.outlet;
  $scope.loading = false;

  $scope.add = function () {
    $scope.loading = true;

    Outlet.create({
        name: $scope.outlet.name,
        address: $scope.outlet.address,
        contact: $scope.outlet.contact
      }).$promise
      .then(function (outlet) {
        $scope.outlets.push(outlet);
        $scope.outlet.name = '';
        $scope.outlet.contact = '';
        $scope.outlet.address = '';
        $scope.loading = false;
      });
  };

  $scope.delete = function ($index) {
    $scope.loading = true;
    var outlet = $scope.outlets[$index];
    Outlet.deleteById({
      id: outlet.id
    }).$promise.then(function () {
      $scope.outlets.splice($index, 1);
      $scope.loading = false;
    });
  };

  $scope.edit = function ($index) {
    $scope.loading = true;
    var outlet = $scope.outlets[$index];
    Outlet.findById({
      id: outlet.id
    }).$promise.then(function (outlet) {
      $scope.outlet = outlet;
      $scope.loading = false;
    });
  }

  $scope.save = function () {
    Outlet.prototype$updateAttributes({
      id: $scope.outlet.id,
      name: $scope.outlet.name,
      address: $scope.outlet.address,
      contact: $scope.outlet.contact
    }).$promise.then(function () {
      $scope.outlets = Outlet.find();
    });
  }
});


app.controller('listSaleRecordController', function ($scope, $rootScope, $http, Outlet, SaleRecord, blockUI) {
  var today = new Date();

  var year = today.getFullYear();
  var month = today.getMonth() + 1;

  $scope.years = [2017, 2018, 2019];
  $scope.months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  $scope.selection = {
    year: year,
    month: month
  }

  $scope.outlets;
  $scope.tables = {};
  $scope.costTables = {};
  $scope.record;

  function calculateCost(salerecords) {
    var totalincome = 0;
    var totalcost = 0;
    var totalexpense = 0;
    var foodpandaincome = 0;
    for (var i = 0; i < salerecords.length; i++) {
      var salerecord = salerecords[i];
      totalincome += salerecord.totalincome;
      foodpandaincome += salerecord.foodpandaincome;
      for (var j = 0; j < salerecord.costRecords.length; j++) {
        var costRecord = salerecord.costRecords[j];
        if (!costRecord.excludeincosting) {
          totalcost += costRecord.unitprice * costRecord.quantity * (1 + costRecord.gst);
        }
        totalexpense += costRecord.unitprice * costRecord.quantity * (1 + costRecord.gst);
      }
    }

    if (totalincome == 0) {
      return {
        totalincome: 0,
        totalexpense: 0,
        totalcost: 0,
        foodpandaincome: 0,
        cost: 0
      };
    }
    // return totalcost / totalincome;
    return {
      totalincome: parseFloat(totalincome.toFixed(2)),
      totalexpense: parseFloat(totalexpense.toFixed(2)),
      totalcost: parseFloat(totalcost.toFixed(2)),
      foodpandaincome: parseFloat(foodpandaincome.toFixed(2)),
      cost: parseFloat((100 * totalcost / totalincome).toFixed(2))
    };
  }

  function loadSaleRecords(outlet) {
    var dateofcurrentmonth = new Date($scope.selection.year, $scope.selection.month - 1);
    var dateofnextmonth = new Date($scope.selection.year, $scope.selection.month);
    blockUI.start();

    SaleRecord.find({
      filter: {
        include: {
          costRecords: [{
            product: ['supplier']
          }]
        },
        where: {
          and: [{
            outletid: outlet.id
          }, {
            date: {
              gte: dateofcurrentmonth
            }
          }, {
            date: {
              lt: dateofnextmonth
            }
          }]
        },
        order: 'date ASC'
      }
    }).$promise.then(function (records) {
      $scope.tables[outlet.name] = records;
      $scope.costTables[outlet.name] = calculateCost(records);
      blockUI.stop();
    });
  }

  var loadAllSaleRecords = function () {
    $scope.outlets = [];
    $scope.tables = {};
    $scope.record = null;
    Outlet.find().$promise.then(function (models) {
      $scope.outlets = models;
      for (var i = 0; i < models.length; i++) {
        var outlet = models[i];
        loadSaleRecords(outlet);
      }
    });
  }

  $rootScope.$on('saleRecordAdded', function () {
    loadAllSaleRecords();
  });

  $scope.search = function () {
    loadAllSaleRecords();
  }

  $scope.view = function (outlet, index) {
    // console.log(outlet, index);
    // console.log($scope.tables[outlet.name][index]);
    $scope.record = {
      outlet: outlet,
      detail: $scope.tables[outlet.name][index]
    }
  }

  $scope.delete = function (record) {
    var confirmed = confirm("确定删除吗？");
    if (!confirmed) return false;

    var salerecordid = record.detail.id;
    SaleRecord.costRecords.destroyAll({
      id: salerecordid
    }).$promise.then(function () {
      SaleRecord.deleteById({
        id: salerecordid
      }).$promise.then(function () {
        $scope.record = null;
        loadAllSaleRecords();
        alert("记录删除成功！");
      });
    });
  }

  loadAllSaleRecords();

});


app.controller('saleRecordController', function ($scope, $rootScope, $http, Supplier, Outlet, SaleRecord, CostRecord, blockUI) {

  $scope.foodpandapayoutrate = 0.635;
  $scope.honestbeepayoutrate = 0.7;
  $scope.gst = 0.07;

  $scope.outlets = Outlet.find();
  $scope.outlet;

  // sale record to insert
  $scope.salerecord = {
    totalincome: null,
    bankincash: null,
    foodpandaincome: null,
    honestbeeincome: null,
    paiditems: [],
    unpaiditems: [],
    date: ''
  };

  $scope.item = {
    paid: false,
    excludeincosting: false
  };

  // list all the suppliers
  $scope.suppliers = Supplier.find();
  $scope.supplier;
  // list all the products under the selected supplier
  $scope.products;
  $scope.product;
  // prepare all the cost records
  $scope.quantity;
  $scope.loading = false;

  $scope.frequency;
  CostRecord.find({
    filter: {
      limit: 50,
      order: 'date desc'
    }
  }).$promise.then(function (records) {
    $scope.frequency = records.reduce(function(state, record){
      if(state[record.productid]){
        state[record.productid] += 1;
      }else{
        state[record.productid] = 1;
      }
      return state;
    }, {});
    // console.log($scope.frequency);
  });

  $scope.$watch('supplier', function (newValue, oldValue) {
    if (newValue != undefined) {
      // $scope.products = Supplier.products({ id: $scope.supplier.id, filter: { include: 'supplier' } });
      Supplier.products({
          id: $scope.supplier.id,
          filter: {
            include: 'supplier'
          }
        })
        .$promise.then(function (products) {
          var _products = products.sort(function(a, b){
            if($scope.frequency){
              var a_frequency = $scope.frequency[a.id] || 0;
              var b_frequency = $scope.frequency[b.id] || 0;

              if(a_frequency > b_frequency) return -1;
              if(a_frequency < b_frequency) return 1;
              return 0;
            }
            return 0;
          });
          //console.log(_products);
          $scope.products = _products;
          if ($scope.products.length > 0) {
            $scope.product = $scope.products[0];
          }
        });
    }
  });

  $scope.$watch('product', function (newValue, oldValue) {
    if (newValue != undefined) {
      if ($scope.product.supplier.hasterm) {
        $scope.item.paid = false;
      } else {
        $scope.item.paid = true;
      }
      if ($scope.product.excludeincosting) {
        $scope.item.excludeincosting = true;
      } else {
        $scope.item.excludeincosting = false;
      }
    }
  });

  function calculateTotalIncome() {
    $scope.salerecord.totalincome = Number($scope.salerecord.bankincash || 0);
    for (var i = 0; i < $scope.salerecord.paiditems.length; i++) {
      var item = $scope.salerecord.paiditems[i];
      $scope.salerecord.totalincome += item.supplier.gstregistered ?
        Number(item.product.unitprice) * Number(item.quantity) * 1.07 : Number(item.product.unitprice) * Number(item.quantity);
    }
    $scope.salerecord.totalincome += ($scope.salerecord.foodpandaincome || 0) * $scope.foodpandapayoutrate;
    $scope.salerecord.totalincome += ($scope.salerecord.honestbeeincome || 0) * $scope.honestbeepayoutrate;
    $scope.salerecord.totalincome = parseFloat($scope.salerecord.totalincome.toFixed(2));
  }

  $scope.$watch('salerecord.foodpandaincome', function (newValue, oldValue) {
    calculateTotalIncome();
  });

  $scope.$watch('salerecord.honestbeeincome', function (newValue, oldValue) {
    calculateTotalIncome();
  });

  $scope.$watch('salerecord.bankincash', function (newValue, oldValue) {
    calculateTotalIncome();
  });

  $scope.$watchCollection('salerecord.paiditems', function (newValue, oldValue) {
    calculateTotalIncome();
  });

  $scope.appendItem = function () {
    if ($scope.item.paid) {
      $scope.salerecord.paiditems.push({
        supplier: $scope.supplier,
        product: $scope.product,
        quantity: $scope.item.quantity,
        unitprice: $scope.product.unitprice,
        gst: $scope.product.supplier.gstregistered ? $scope.gst : 0,
        paid: true,
        excludeincosting: $scope.item.excludeincosting || false
      });
    } else {
      $scope.salerecord.unpaiditems.push({
        supplier: $scope.supplier,
        product: $scope.product,
        quantity: $scope.item.quantity,
        unitprice: $scope.product.unitprice,
        gst: $scope.product.supplier.gstregistered ? $scope.gst : 0,
        paid: false,
        excludeincosting: $scope.item.excludeincosting || false
      });
    }

    $scope.item = {
      paid: false,
      excludeincosting: false
    };
  }

  $scope.removeItem = function ($index, paid) {
    if (paid) {
      $scope.salerecord.paiditems.splice($index, 1);
    } else {
      $scope.salerecord.unpaiditems.splice($index, 1);
    }
  }

  $scope.add = function () {
    if (!$scope.salerecord.date) {
      alert('请选择日期！');
      return false;
    }
    if (!$scope.outlet) {
      alert('请选择档口！');
      return false;
    }
    if (isNaN($scope.salerecord.totalincome)) {
      alert('请输入正确营业额！');
      return false;
    }
    var confirmed = confirm("确定上报营业额吗？");
    if (!confirmed) return false;
    blockUI.start();
    SaleRecord.create({
        totalincome: $scope.salerecord.totalincome || 0,
        bankincash: $scope.salerecord.bankincash || 0,
        foodpandaincome: $scope.salerecord.foodpandaincome || 0,
        honestbeeincome: $scope.salerecord.honestbeeincome || 0,
        outletid: $scope.outlet.id,
        date: $scope.salerecord.date
      }).$promise
      .then(function (salerecord) {
        if (salerecord) {
          var cost = [];
          for (var i = 0; i < $scope.salerecord.paiditems.length; i++) {
            var item = $scope.salerecord.paiditems[i];
            cost.push({
              productid: item.product.id,
              date: $scope.salerecord.date,
              quantity: item.quantity,
              paid: true,
              salerecordid: salerecord.id,
              unitprice: item.unitprice,
              gst: item.gst,
              excludeincosting: item.excludeincosting
            });
          }
          for (var i = 0; i < $scope.salerecord.unpaiditems.length; i++) {
            var item = $scope.salerecord.unpaiditems[i];
            cost.push({
              productid: item.product.id,
              date: $scope.salerecord.date,
              quantity: item.quantity,
              paid: false,
              salerecordid: salerecord.id,
              unitprice: item.unitprice,
              gst: item.gst,
              excludeincosting: item.excludeincosting
            });
          }
          if (cost.length > 0) {
            CostRecord.createMany(cost).$promise
              .then(function (models) {
                $scope.salerecord = {
                  totalincome: 0,
                  bankincash: null,
                  foodpandaincome: null,
                  honestbeeincome: null,
                  paiditems: [],
                  unpaiditems: []
                };

                $rootScope.$broadcast('saleRecordAdded');
                blockUI.stop();
                alert('上报成功！');
              });
          } else {
            $scope.salerecord = {
              totalincome: 0,
              bankincash: null,
              foodpandaincome: null,
              honestbeeincome: null,
              paiditems: [],
              unpaiditems: []
            };

            $rootScope.$broadcast('saleRecordAdded');
            blockUI.stop();
            alert('上报成功！');
          }
        }
      });
  };

  $scope.delete = function ($index) {

  };


});


app.controller('supplierController', function ($scope, $http, Supplier) {

  $scope.suppliers = Supplier.find();
  $scope.supplier;
  $scope.loading = false;

  $scope.add = function () {
    $scope.loading = true;
    Supplier.create({
        name: $scope.supplier.name,
        contact: $scope.supplier.contact,
        gstregistered: $scope.supplier.gstregistered || false,
        hasterm: $scope.supplier.hasterm || false
      }).$promise
      .then(function (supplier) {
        $scope.suppliers.push(supplier);
        $scope.supplier.name = '';
        $scope.supplier.contact = '';
        $scope.supplier.gstregistered = false;
        $scope.supplier.hasterm = false;
        $scope.loading = false;
      });
  };

  $scope.delete = function ($index) {
    $scope.loading = true;
    var supplier = $scope.suppliers[$index];
    Supplier.deleteById({
      id: supplier.id
    }).$promise.then(function () {
      $scope.suppliers.splice($index, 1);
      $scope.loading = false;
    });
  };

  $scope.edit = function ($index) {
    var supplier = $scope.suppliers[$index];
    Supplier.findById({
      id: supplier.id
    }).$promise.then(function (supplier) {
      $scope.supplier = supplier;
    });
  }

  $scope.save = function () {
    Supplier.prototype$updateAttributes({
      id: $scope.supplier.id,
      name: $scope.supplier.name,
      contact: $scope.supplier.contact,
      gstregistered: $scope.supplier.gstregistered,
      hasterm: $scope.supplier.hasterm
    }).$promise.then(function () {
      $scope.suppliers = Supplier.find();
    });
  }
});



app.controller('productController', function ($scope, $http, Product, Supplier) {
  $scope.suppliers = Supplier.find();
  $scope.products = Product.find({
    filter: {
      include: 'supplier',
      order: 'supplierid asc'
    }
  });
  $scope.product;
  $scope.loading = false;

  $scope.add = function () {
    Product.create({
      name: $scope.product.name,
      unitprice: $scope.product.unitprice,
      supplierid: $scope.product.supplier.id,
      unit: $scope.product.unit,
      excludeincosting: $scope.product.excludeincosting || false
    }).$promise.then(function (product) {
      //$scope.products.push(product);
      $scope.products = Product.find({
        filter: {
          include: 'supplier',
          order: 'supplierid asc'
        }
      });
      $scope.product.name = '';
      $scope.product.unitprice = '';
      $scope.product.unit = '';
      $scope.product.excludeincosting = false;
    });
  };

  $scope.delete = function ($index) {
    $scope.loading = true;
    var product = $scope.products[$index];

    Product.deleteById({
      id: product.id
    }).$promise  .then(function () {
      $scope.products.splice($index, 1);
      $scope.loading = false;
    });
  };

  $scope.edit = function ($index) {
    var product = $scope.products[$index];
    Product.findById({
      id: product.id,
      filter: {
        include: 'supplier'
      }
    }).$promise.then(function (product) {
      $scope.product = product;
      var supplier = $scope.suppliers.filter(function (ele, index, arr) {
        return ele.id == product.supplierid;
      });
      $scope.product.supplier = supplier[0];
    });
  }

  $scope.save = function () {
    Product.prototype$updateAttributes({
      id: $scope.product.id,
      name: $scope.product.name,
      unitprice: $scope.product.unitprice,
      supplierid: $scope.product.supplier.id,
      unit: $scope.product.unit,
      excludeincosting: $scope.product.excludeincosting || false
    }).$promise.then(function () {
      $scope.products = Product.find({
        filter: {
          include: 'supplier',
          order: 'supplierid asc'
        }
      });
    });
  }

});


app.controller('reportController', function ($scope, $rootScope, $http, Outlet, SaleRecord, Supplier, CostRecord, blockUI) {
  var today = new Date();

  var year = today.getFullYear();
  var month = today.getMonth() + 1;

  $scope.years = [2017, 2018, 2019];
  $scope.months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  $scope.selection = {
    year: year,
    month: month
  }

  $scope.suppliers = Supplier.find();
  $scope.supplier;

  $scope.outlets;
  $scope.tables = {};
  $scope.costTables = {};
  $scope.record;

  function loadReport(outlet, supplier) {
    var dateofcurrentmonth = new Date($scope.selection.year, $scope.selection.month - 1);
    var dateofnextmonth = new Date($scope.selection.year, $scope.selection.month);
    blockUI.start();

    CostRecord.find({
        filter: {
          include: ['product', 'saleRecord'],
          where: {
            and: [{
              date: {
                gte: dateofcurrentmonth
              }
            }, {
              date: {
                lt: dateofnextmonth
              }
            }]
          },
          order: 'date ASC'
        }
      })
      .$promise.then(function (records) {
        var _records = records.filter(function (value) {
          return value.product.supplierid == supplier.id && value.saleRecord.outletid == outlet.id;
        });

        $scope.tables[outlet.name] = _records;
        $scope.costTables[outlet.name] = _records.reduce(function (pre, cur) {
          return pre + cur.unitprice * cur.quantity * (1 + cur.gst);
        }, 0);

        blockUI.stop();
      });

  }


  $scope.search = function () {
    if (!$scope.supplier) {
      alert('选择供应商');
      return;
    }
    // console.log($scope.supplier);
    $scope.outlets = [];
    $scope.tables = {};
    $scope.record = null;
    Outlet.find().$promise.then(function (models) {
      $scope.outlets = models;
      for (var i = 0; i < models.length; i++) {
        var outlet = models[i];
        // loadSaleRecords(outlet);
        loadReport(outlet, $scope.supplier);
      }
    });
  }

});
