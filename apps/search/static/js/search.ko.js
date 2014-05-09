// Licensed to Cloudera, Inc. under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  Cloudera, Inc. licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.


// Start dashboard lib to move out

var Column = function (size, rows) {
  var self = this;
  self.size = ko.observable(size);
  self.rows = ko.observableArray(rows);
  self.klass = ko.computed(function () {
    return "card card-home card-column span" + self.size();
  });
  self.addEmptyRow = function () {
    self.addRow();
  };
  self.addRow = function (row) {
    if (typeof row == "undefined" || row == null) {
      row = new Row([]);
    }
    self.rows.push(row);
  };
}

var Row = function (widgets) {
  var self = this;
  self.widgets = ko.observableArray(widgets);

  self.addWidget = function (widget) {
    self.widgets.push(widget);
  };

  self.move = function (from, to) {
    try {
      viewModel.columns()[to].addRow(self);
      viewModel.columns()[from].rows.remove(self);
    }
    catch (exception) {
    }
  }

  self.moveDown = function (col, row) {
    var _i = col.rows().indexOf(row);
    if (_i < col.rows().length - 1) {
      var _arr = col.rows();
      col.rows.splice(_i, 2, _arr[_i + 1], _arr[_i]);
    }
  }

  self.moveUp = function (col, row) {
    var _i = col.rows().indexOf(row);
    if (_i >= 1) {
      var _arr = col.rows();
      col.rows.splice(_i - 1, 2, _arr[_i], _arr[_i - 1]);
    }
  }

  self.remove = function (col, row) {
	$.each(self.widgets(), function(i, widget) {
	  viewModel.removeWidget(widget);
	}); 
    col.rows.remove(row);
  }
}

// A widget is generic. It has an id that refer to another object (e.g. facet) with the same id.
var Widget = function (size, id, name, widgetType, properties, offset, loading) {
  var self = this;
  self.size = ko.observable(size).extend({ numeric: 0 });

  self.name = ko.observable(name);
  self.id = ko.observable(id);
  self.widgetType = ko.observable(typeof widgetType != "undefined" && widgetType != null ? widgetType : "empty-widget");
  self.properties = ko.observable(typeof properties != "undefined" && properties != null ? properties : {});
  self.offset = ko.observable(typeof offset != "undefined" && offset != null ? offset : 0).extend({ numeric: 0 });
  self.isLoading = ko.observable(typeof loading != "undefined" && loading != null ? loading : false);


  self.klass = ko.computed(function () {
    return "card card-widget span" + self.size() + (self.offset() * 1 > 0 ? " offset" + self.offset() : "");
  });

  self.expand = function () {
    self.size(self.size() + 1);
  }
  
  self.compress = function () {
    self.size(self.size() - 1);
  }

  self.moveLeft = function () {
    self.offset(self.offset() - 1);
  }
  
  self.moveRight = function () {
    self.offset(self.offset() + 1);
  }

  self.remove = function (row, widget) {
    viewModel.removeWidget(widget);
    row.widgets.remove(widget);
  }
};

Widget.prototype.clone = function () {
  return new Widget(this.size(), UUID(), this.name(), this.widgetType());
};

function fullLayout() {
  setLayout([12]);
}

function oneThirdLeftLayout() {
  setLayout([2, 10]);
}

function oneThirdRightLayout() {
  setLayout([9, 3]);
}

function magicLayout(vm) {
  loadLayout(vm, vm.initial.layout);
}

function setLayout(colSizes) {
  // Save previous widgets
  var _allRows = [];
  $(viewModel.columns()).each(function (cnt, col) {
    var _tRows = [];
    $(col.rows()).each(function (icnt, row) {
      if (row.widgets().length > 0) {
        _tRows.push(row);
      }
    });
    _allRows = _allRows.concat(_tRows);
  });

  var _cols = [];
  var _highestCol = {
    idx: -1,
    size: -1
  };
  $(colSizes).each(function (cnt, size) {
    _cols.push(new Column(size, []));
    if (size > _highestCol.size) {
      _highestCol.idx = cnt;
      _highestCol.size = size;
    }
  });
  if (_allRows.length > 0 && _highestCol.idx > -1) {
    _cols[_highestCol.idx].rows(_allRows);
  }

  $(_cols).each(function (cnt, col) {
    if (col.rows().length == 0) {
      col.rows([new Row([])]);
    }
  });

  viewModel.columns(_cols);
}

function loadLayout(viewModel, json_layout) {
  var _columns = [];
  
  $(json_layout).each(function (cnt, json_col) { 
    var _rows = [];
    $(json_col.rows).each(function (rcnt, json_row) {
      var row = new Row();
      $(json_row.widgets).each(function (wcnt, widget) {
        row.addWidget(new Widget(widget.size, widget.id, widget.name, widget.widgetType, widget.properties, widget.offset, true));
      });
      _rows.push(row);
    });
    var column = new Column(json_col.size, _rows);
    _columns = _columns.concat(column);
  });

  viewModel.columns(_columns);
}

// End dashboard lib

var Query = function (vm, query) {
  var self = this;

  self.qs = ko.mapping.fromJS(query.qs);
  self.fqs = ko.mapping.fromJS(query.fqs);
  var defaultMultiqGroup = {'id': 'query', 'label': 'query'};
  self.multiqs = ko.computed(function () { // List of widgets supporting multiqs
	var histogram_id = vm.collection.getHistogramFacet();
    return [defaultMultiqGroup].concat(
        $.map($.grep(self.fqs(), function(fq, i) {
            return (fq.type() == 'field' || fq.type() == 'range') && (histogram_id == null || histogram_id.id() != fq.id());
        }), function(fq) { return {'id': fq.id(), 'label': fq.field()} })
      );
  });
  self.selectedMultiq = ko.observable(defaultMultiqGroup);

  self.getFacetFilter = function (widget_id) {
    var _fq = null;
    $.each(self.fqs(), function (index, fq) { 
      if (fq.id() == widget_id) {
        _fq = fq;
        return false;
      }
    });
    return _fq;
  };

  self.getMultiq = ko.computed(function () {
    if (self.selectedMultiq()) {
    if (self.selectedMultiq() == 'query') {
      if (self.qs().length >= 2) {
        return 'query';
      }
      } else {
        var facet = self.getFacetFilter(self.selectedMultiq());
        if (facet && facet.filter().length > 0) { // todo + histogram there?
          return 'facet';
        }
      }
    }
  return null;
  });
  
  self.selectedMultiq.subscribe(function () { // To keep below the computed
    vm.search();
  });
  
  self.addQ = function (data) {
    self.qs.push(ko.mapping.fromJS({'q': ''}));
  };
  
  self.removeQ = function (query) {
    self.qs.remove(query);
  };
  
  self.toggleFacet = function (data) {
    var fq = self.getFacetFilter(data.widget_id);

    if (fq == null) {
      self.fqs.push(ko.mapping.fromJS({
        'id': data.widget_id,
        'field': data.facet.cat,
        'filter': [data.facet.value],
        'type': 'field'
      }));
    } else {
      $.each(self.fqs(), function (index, fq) {
        if (fq.id() == data.widget_id) {
          if (fq.filter.indexOf(data.facet.value) > -1) {
            fq.filter.remove(data.facet.value);
            if (fq.filter().length == 0) {
              self.fqs.remove(fq);
            }
          } else {
            fq.filter.push(data.facet.value);
          }
        }
      });
    }
  
    vm.search();
  }  
  
  self.selectRangeFacet = function (data) {
    if (data.force != undefined) {
      self.removeFilter(ko.mapping.fromJS({'id': data.widget_id}));
    }
    
	var fq = self.getFacetFilter(data.widget_id);
	  
    if (fq == null) {
      self.fqs.push(ko.mapping.fromJS({
          'id': data.widget_id,
          'field': data.cat,
          'filter': [data.from],
          'properties': [{'from': data.from, 'to': data.to}],
          'type': 'range'
      }));    	
    } else {    
      if (fq.filter().indexOf(data.from) > -1) { // Unselect
    	fq.filter.remove(data.from);
    	$.each(fq.properties(), function (index, prop) {
    	  if (prop && prop.from() == data.from) {
    	    fq.properties.remove(prop);
    	  }
    	});
    	if (fq.filter().length == 0) {
          self.removeFilter(ko.mapping.fromJS({'id': data.widget_id}));
    	}    	 
      } else {
    	 fq.filter.push(data.from);
    	 fq.properties.push(ko.mapping.fromJS({'from': data.from, 'to': data.to}));
      }
    }

    if (data.no_refresh == undefined) {
      vm.search();
    }
  };
  
  self.removeFilter = function (data) { 
    $.each(self.fqs(), function (index, fq) {
      if (fq.id() == data.id()) {          
        self.fqs.remove(fq);
        return false;
      }
    });
  };   
};


var Collection = function (vm, collection) {
  var self = this;

  self.id = collection.id;
  self.name = ko.mapping.fromJS(collection.name);
  self.label = ko.mapping.fromJS(collection.label);
  self.idField = collection.idField;
  self.template = ko.mapping.fromJS(collection.template);
  self.template.fieldsSelected.subscribe(function () {
    vm.search();
  });
  self.template.template.extend({ rateLimit: { method: "notifyWhenChangesStop", timeout: 400 } }); // hum?
  self.template.template.subscribe(function () {
    vm.search();
  });
  self.template.isGridLayout.subscribe(function () {
    vm.search();
  });
  self.facets = ko.mapping.fromJS(collection.facets);
  $.each(self.facets(), function (index, facet) {
    facet.field.subscribe(function () {
      vm.search();
    });
  });


  self.fields = ko.mapping.fromJS(collection.fields);
  self.availableFacetFields = ko.computed(function() {
    var facetFieldNames = $.map(self.facets(), function(facet) {
	  return facet.field();
    });
    return $.grep(self.fields(), function(field) {
      return facetFieldNames.indexOf(field.name()) == -1;
    });
  });

  self.addFacet = function (facet_json) {
    $.post("/search/template/new_facet", {
      "collection": ko.mapping.toJSON(self),
        "id": facet_json.widget_id,
        "label": facet_json.name,
        "field": facet_json.name,
        "widget_type": facet_json.widgetType
      }, function (data) {
        if (data.status == 0) {
          var facet = ko.mapping.fromJS(data.facet);
          facet.field.subscribe(function () {
            vm.search();
          });      
          self.facets.push(facet);
          vm.search();
        } else {
          $(document).trigger("error", data.message);
        }
    }).fail(function (xhr, textStatus, errorThrown) {});
  };

  self.removeFacet = function (widget_id) {
    $.each(self.facets(), function (index, facet) {  
      if (facet.id() == widget_id()) {
        self.facets.remove(facet); 
        return false;
      }
    });
  }  
  
  self.getFacetById = function (facet_id) {
    var _facet = null;
    $.each(self.facets(), function (index, facet) {
      if (facet.id() == facet_id) {
        _facet = facet;
        return false;
      }
    });
    return _facet;
  }

  self.getFacetByType = function (facetType) {
    var _facet = null;
    $.each(self.facets(), function (index, facet) {
      if (facet.widgetType() == facetType) {
        _facet = facet;
        return false;
      }
    });
    return _facet;
  }
  
  self.getHistogramFacet = function () { // might remove when list of available widgets
    return self.getFacetByType('histogram-widget');
  }
  
  self.template.fields = ko.computed(function () {
    var _fields = [];
    $.each(self.template.fieldsAttributes(), function (index, field) {
      var position = self.template.fieldsSelected.indexOf(field.name());
      if (position != -1) {
        _fields[position] = field;
      }      
    });
    return _fields;
  });

  self.getTemplateField = function (name) {
    var _field = null;
    $.each(self.template.fields(), function (index, field) {
      if (field.name() == name) {
      _field = field;
        return false;
      }
    });
    return _field;    
  };

  self.template.fieldsModalFilter = ko.observable("");
  self.template.filteredFieldsAttributes = ko.observableArray(self.template.fieldsAttributes());

  self.template.fieldsModalFilter.subscribe(function(value){
    var _fields = [];
    $.each(self.template.fieldsAttributes(), function (index, field) {
      if (field.name().toLowerCase().indexOf(self.template.fieldsModalFilter().toLowerCase()) > -1){
        _fields.push(field);
      }
    });
    self.template.filteredFieldsAttributes(_fields);
  });


  self.addDynamicFields = function () { // + Adding merge smartly if schema updated
    $.post("/search/index/" + self.id + "/fields/dynamic", {
      }, function (data) {
      if (data.status == 0) {
        $.each(data.dynamic_fields, function (index, field) {
          if (self.fields.indexOf(field) == -1) {
            self.fields.push(field);
          }
        });
      }
    }).fail(function (xhr, textStatus, errorThrown) {});
  }

  self.toggleSortColumnGridLayout = function (template_field) {
    if (! template_field.sort.direction()) {
      template_field.sort.direction('desc');
    } else if (template_field.sort.direction() == 'desc') {
      template_field.sort.direction('asc');
    } else {
      template_field.sort.direction(null); 
    }

    vm.search();
  };
  
  self.toggleSortFacet = function (facet_field, event) {
    if (facet_field.properties.sort() == 'desc') {
      facet_field.properties.sort('asc');
    } else {
      facet_field.properties.sort('desc');
    }   
   
    $(event.target).button('loading');
    vm.search();
  };

  self.toggleRangeFacet = function (facet_field, event) {
    vm.query.removeFilter(ko.mapping.fromJS({'id': facet_field.id})); // Reset filter query
 
    if (facet_field.type() == 'field') {
       facet_field.type('range');
     } else if (facet_field.type() == 'range') {
        facet_field.type('field')
     }
   
    $(event.target).button('loading');
    vm.search();
  };  

  self.selectTimelineFacet = function (data) { // alert(ko.mapping.toJSON(facet)); 
    var facet = self.getFacetById(data.widget_id);
  
    facet.properties.start(data.from);
    facet.properties.end(data.to);
  
    vm.query.selectRangeFacet({widget_id: data.widget_id, from: data.from, to: data.to, cat: data.cat, no_refresh: true, force: true});
  
    $.ajax({
      type: "POST",
      url: "/search/get_range_facet",    
      data: {
        collection: ko.mapping.toJSON(self),
        facet: ko.mapping.toJSON(facet),
        action: 'select'
      },
      success: function (data) {
        if (data.status == 0) {
          facet.properties.gap(data.properties.gap);
        }
      },
      async: false
    });  
  
    vm.search();
  }

  self.timeLineZoom = function (facet_json) { 
    var facet = self.getFacetById(facet_json.id);

    facet.properties.start(facet.from);
    facet.properties.end(facet.to);
  
    $.ajax({
      type: "POST",
      url: "/search/get_range_facet",    
      data: {
        collection: ko.mapping.toJSON(self),
        facet: ko.mapping.toJSON(facet),
        action: "zoom_out"
      },
      success: function (data) {
        if (data.status == 0) {
          facet.properties.start(data.properties.start);
          facet.properties.end(data.properties.end);
          facet.properties.gap(data.properties.gap);
        }
      },
      async: false
    });  
  
    vm.search();
  }
  
  self.translateSelectedField = function (index, direction) {
    var array = self.template.fieldsSelected();

    if (direction == 'left') {
      self.template.fieldsSelected.splice(index - 1, 2, array[index], array[index - 1]);
    } else {
      self.template.fieldsSelected.splice(index, 2, array[index + 1], array[index]);
    }
  
    vm.search();
  };
};

var NewTemplate = function (vm, initial) {
  var self = this;

  self.collections = ko.mapping.fromJS(initial.collections);
  self.collections.subscribe(function (newValue) {
    vm.collection.name(newValue);
  });
  
  self.layout = initial.layout;
};


var SearchViewModel = function (collection_json, query_json, initial_json) {
  var self = this;

  // Models
  self.collection = new Collection(self, collection_json.collection);
  self.query = new Query(self, query_json);
  self.initial = new NewTemplate(self, initial_json);

  if (initial_json.collections) {
    self.collection.name.subscribe(function (newValue) {
	  self.collection.label(newValue);
    });
  }
  
  // UI
  self.response = ko.observable({});
  self.results = ko.observableArray([]);
  self.norm_facets = ko.computed(function () {
    return self.response().normalized_facets;
  });
  self.getFacetFromQuery = function (facet_id) {  
    var _facet = null;
    if (self.norm_facets() !== undefined) {
      $.each(self.norm_facets(), function (index, norm_facet) {  
        if (norm_facet.id == facet_id) {
          _facet = norm_facet;
        }      
      });
    }
    return _facet;    
  };

  self.previewColumns = ko.observable("");
  self.columns = ko.observable([]);
  loadLayout(self, collection_json.layout);

  self.isEditing = ko.observable(false);
  self.toggleEditing = function () {
    self.isEditing(!self.isEditing());
  };
  self.isRetrievingResults = ko.observable(false);
      
  self.draggableHit = ko.observable(new Widget(12, UUID(), "Hit Count", "hit-widget"));
  self.draggableFacet = ko.observable(new Widget(12, UUID(), "Facet", "facet-widget"));
  self.draggableResultset = ko.observable(new Widget(12, UUID(), "Grid Results", "resultset-widget"));
  self.draggableHtmlResultset = ko.observable(new Widget(12, UUID(), "HTML Results", "html-resultset-widget"));
  self.draggableHistogram = ko.observable(new Widget(12, UUID(), "Histogram", "histogram-widget"));
  self.draggableBar = ko.observable(new Widget(12, UUID(), "Bar Chart", "bar-widget"));
  self.draggableMap = ko.observable(new Widget(12, UUID(), "Map", "map-widget"));
  self.draggableLine = ko.observable(new Widget(12, UUID(), "Line Chart", "line-widget"));
  self.draggablePie = ko.observable(new Widget(12, UUID(), "Pie Chart", "pie-widget"));
  self.draggableFilter = ko.observable(new Widget(12, UUID(), "Filter Bar", "filter-widget"));  

  function getWidgets(equalsTo) {
	return $.map(self.columns(), function (col){return $.map(col.rows(), function(row){ return $.grep(row.widgets(), function(widget){ return equalsTo(widget); });}) ;})
  };
  
  self.availableDraggableResultset = ko.computed(function() {
	return getWidgets(function(widget){ return ['resultset-widget', 'html-resultset-widget'].indexOf(widget.widgetType()) != -1; }).length == 0;
  });
  self.availableDraggableFilter = ko.computed(function() {
	return getWidgets(function(widget){ return widget.widgetType() == 'filter-widget'; }).length == 0;
  });  
  self.availableDraggableHistogram = ko.computed(function() {
	return getWidgets(function(widget){ return widget.widgetType() == 'histogram-widget'; }).length == 0 &&
	  $.map(self.collection.availableFacetFields(), function(field) { return ['date', 'tdate'].indexOf(field.type()) != -1; });
  });
  self.availableDraggableChart = ko.computed(function() {
    return self.collection.availableFacetFields().length > 0;
  });
  
  self.init = function () {
    //self.collection.addDynamicFields();
    self.isEditing(true);
    self.search();
  }

  self.search = function () {
    self.isRetrievingResults(true);
    $(".jHueNotify").hide();
    
    // Multi queries    
    var multiQs = [];
    var multiQ = self.query.getMultiq();
    
    if (multiQ != null) {
      var facet = {};
      var queries = [];
      
      if (multiQ == 'query') {
        queries = self.query.qs();
      } else {
        facet = self.query.getFacetFilter(self.query.selectedMultiq());
        queries = facet.filter();       
      }
      
      multiQs = $.map(queries, function(qdata) {
        return $.post("/search/get_timeline", {
            collection: ko.mapping.toJSON(self.collection),
            query: ko.mapping.toJSON(self.query),
            facet: ko.mapping.toJSON(facet),
            qdata: ko.mapping.toJSON(qdata),
            multiQ: multiQ
          }, function (data) {return data});
      });              
    }

    $.when.apply($, [
      $.post("/search/search", {
        collection: ko.mapping.toJSON(self.collection),
        query: ko.mapping.toJSON(self.query),
        layout: ko.mapping.toJSON(self.columns)
      }, function (data) {
        self.response(data);
        self.results.removeAll();
        if (data.error) {
          $(document).trigger("error", data.error);
        }
        else {
          if (self.collection.template.isGridLayout()) {
            // Table view
            $.each(data.response.docs, function (index, item) {
              var row = [];
              var fields = self.collection.template.fieldsSelected();
              // Display selected fields or whole json document
              if (fields.length != 0) {
                $.each(self.collection.template.fieldsSelected(), function (index, field) {  
                  row.push(item[field]);
                });
              } else {
                row.push(ko.mapping.toJSON(item)); 
              }
              var doc = {'id': item[self.collection.idField], 'row': row};
              self.results.push(doc);
            });
          }
          else {
            // Template view
            var _mustacheTmpl = fixTemplateDotsAndFunctionNames(self.collection.template.template());
            $.each(data.response.docs, function (index, item) {
              addTemplateFunctions(item);
              self.results.push(Mustache.render(_mustacheTmpl, item));
            });
          }
          self.isRetrievingResults(false);
        }
      })
      ].concat(multiQs)
    )
    .done(function() {
      if (arguments[0] instanceof Array) { // If multi queries
      var histoFacetId = self.collection.getHistogramFacet().id();
      var histoFacet = self.getFacetFromQuery(histoFacetId);  
        for (var i = 1; i < arguments.length; i++) {
          histoFacet.extraSeries.push(arguments[i][0]['series']);
        }
        self.response.valueHasMutated();
      }
    })
    .fail(function (xhr, textStatus, errorThrown) {
      $(document).trigger("error", xhr.responseText);
    })
    .always(function () {
      $('.btn-loading').button('reset');
    });
  };
  
  self.removeWidget = function (widget_json) {
    self.collection.removeFacet(widget_json.id);
    self.query.removeFilter(widget_json);
    self.search();
  }

  self.getWidgetById = function (widget_id) {
    var _widget = null;
    $.each(self.columns(), function (i, col) {
      $.each(col.rows(), function (j, row) {
        $.each(row.widgets(), function (z, widget) {
          if (widget.id() == widget_id){
            _widget = widget;
          }
        });
      });
    });
    return _widget;
  }

  self.getDocument = function (doc) {
    $.post("/search/get_document", {
      collection: ko.mapping.toJSON(self.collection),
      id: doc.id
    },function (data) {
      if (data.status == 0) {
        alert(ko.mapping.toJSON(data.doc.doc));
      }
      else if (data.status == 1) {
        $(document).trigger("info", data.message);
      }
      else {
        $(document).trigger("error", data.message);
      }
    }).fail(function (xhr, textStatus, errorThrown) {
      $(document).trigger("error", xhr.responseText);
    });
  };  
  
  self.save = function () {
    $.post("/search/save", {
      collection: ko.mapping.toJSON(self.collection),
      layout: ko.mapping.toJSON(self.columns)
    },function (data) {
      if (data.status == 0) {
        self.collection.id = data.id;
        $(document).trigger("info", data.message);
      }
      else {
        $(document).trigger("error", data.message);
      }
    }).fail(function (xhr, textStatus, errorThrown) {
      $(document).trigger("error", xhr.responseText);
    });
  };
};
