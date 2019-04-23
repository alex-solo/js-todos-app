$(function() {
  let todos;
  let navContext = {};
  let mainContext = {};
  let crntTitle;
  let crntLocation;
  let crntId;
  let crntTodo;

  const templates = {};

  $("script[type='text/x-handlebars']").each(function() {
    const $tmpl = $(this);
    templates[$tmpl.attr("id")] = Handlebars.compile($tmpl.html()); 
  });

  $("[data-type=partial]").each(function() {
    const $partial = $(this);
    Handlebars.registerPartial($partial.attr("id"), $partial.html());
  });

  $.ajax({
    url: "/api/todos",
    type: "GET",
    dataType: "json",
  })
  .done(json => {
    todos = json;
    renderPage();

    nav.init();
    main.init();
    modal.init();
  });

  const modal = {
    handleMarkButton: function(e) {
      e.preventDefault();
      const $f = $("#form_modal").find("form");
      
      if ($f.hasClass("new_item")) alert("Cannot mark as complete as item has not been created yet!");
      if ($f.hasClass("update")) (!crntTodo.completed) ? this.updateTodo({completed: true}, this.setToTrue) : $(".modal").hide();
    },
    setToTrue: function() {
      crntTodo.completed = true;
    },
    setAllParams: function(json) {
      const idx = todos.findIndex(todo => todo.id === crntTodo.id);
      todos[idx] = json;
    },
    handleSaveButton: function(e) {
      e.preventDefault();
      const $f = $("#form_modal").find("form");
      const $inpts = $f.find("input[type=text], select[id^='due_'], textarea");
      let data = this.getTodoObj($inpts);

      if (data.title.length < 3) {
        alert("You must enter a title at least 3 characters long.");
        return;
      }

      if ($f.hasClass("update")) {
        this.updateTodo(data, this.setAllParams);
      } else if ($f.hasClass("new_item")) {
        this.updateTodo(data, this.addNewTodo);
      }
    },
    updateTodo: function(data, callback) {
      const $f = $("#form_modal").find("form");
      $.ajax({
        url: $f.attr("action"),
        type: $f.attr("method"),
        data: JSON.stringify(data),
        contentType: "application/json"
      })
      .done(json => {
        callback(json);
        renderPage();
      });
    },
    addNewTodo: function(json) {
      todos.push(json);
      crntTitle = "All Todos";
      crntLocation = "all";
    },
    getTodoObj: function($inpts) {
      let data = {};
      $inpts.each(function() {
        const $inpt = $(this);
        let val = $inpt.val();
        if (val === "Day" || val === "Month" || val === "Year") val = "";
        data[$inpt.attr("name")] = val;
      });

      return data;
    },
    bind: function() {
      $("#items").on("click", "button[name='complete']", this.handleMarkButton.bind(this));
      $("#items").on("click", "input[type='submit']", this.handleSaveButton.bind(this));
    },
    init: function() {
      this.bind();
    },
  };

  const main = {
    showModalLayer: function(e) {
      this.updateForm(e);
      $(".modal").fadeIn(500);
    },
    updateForm: function(e) {
      const clickedOn = e.currentTarget.tagName;
      const $f = $("#form_modal").find("form");
      $f[0].reset();

      if (clickedOn === "LABEL") {
        $f.attr("method", "POST");
        $f.attr("action", "/api/todos");
        $f.attr("class", "new_item");
      } else if (clickedOn === "TD") {
        crntId = this.getId(e);
        crntTodo = findTodo(crntId);
        const $inpts = $f.find("input[type=text], select[id^='due_'], textarea");

        this.updateInputValues(crntTodo, $inpts);
        
        $f.attr("method", "PUT");
        $f.attr("action", `/api/todos/${crntId}`);
        $f.attr("class", "update");
      }
    },
    updateInputValues: function(todo, $inpts) {
      $inpts.each(function() {
        const $inpt = $(this);
        const val = todo[$inpt.attr("name")];

        if (val) $inpt.val(val);
      });
    },
    removeModalLayer: function(e) {
      $(".modal").fadeOut(500);
    },
    getId: function(e) {
      return $(e.target).parents("tr").attr("data-id");
    },
    deleteTodo: function(e) {
      const id = this.getId(e);
      $.ajax({
        url: `/api/todos/${id}`,
        type: "DELETE"
      })
      .done(() => {
        const idx = todos.findIndex(todo => todo.id === +id);
        todos.splice(idx, 1);

        renderPage();
      });
    },
    checkItem: function(e) {
      const $el = $(e.target);
      const id = $el.parents("tr").attr("data-id");
      const $inpt = $el.parents("tr").find("input");
      let changeTo = !$inpt.prop("checked");

      $.ajax({
        url: `/api/todos/${id}`,
        type: "PUT",
        data: JSON.stringify({completed: changeTo}),
        contentType: "application/json"
      })
      .done(() => {
        findTodo(id).completed = changeTo;
    
        renderPage();
      });
    },
    bind: function() {
      $("#items").on("click", "label[for='new_item']", this.showModalLayer.bind(this));
      $("#items").on("click", "#modal_layer", this.removeModalLayer.bind(this));
      $("#items").on("click", ".delete", this.deleteTodo.bind(this));
      $("#items").on("click", ".list_item", e => {
        e.preventDefault();
        if (e.target.tagName === "TD" || e.target.tagName === "SPAN") {
          this.checkItem(e);
        } else if (e.target.tagName === "LABEL") {
          this.showModalLayer(e);
        } 
      });
    },
    init: function() {
      this.bind();
    },
  };

  const nav = {
    findActive: function() {
      return $("#sidebar").find(".active");
    },
    makeActive: function($el) {
      this.findActive().removeClass("active");
      $el.addClass("active");
    },
    updateMain: function($el) {
      crntTitle = $el.attr("data-title");
      crntLocation = $el.parents("section").attr("id");

      buildMainContext();
      updateMainPage();

      this.makeActive($el);
    },
    findElement: function(e) {
      let $clicked = $(e.currentTarget);
      let $el;

      if ($clicked.is("div")) {
        $el = $clicked.find("header");
      } else if ($clicked.is("dl")) {
        $el = $clicked;
      }

      return $el;
    },
    handleClick: function(e) {
      let $el = this.findElement(e);
      this.updateMain($el);
    },
    bind: function() {
      $("#sidebar").on("click", "div, #all_lists dl, #completed_lists dl", this.handleClick.bind(this));
    },
    init: function() {
      this.bind();
    },
  };

  function selectedTodos() {
    return todosForTitle().sort((a, b) => a.id - b.id)
                          .sort((a, b) => a.completed - b.completed) 
                          .map(todo => ({"id": todo.id, "title": todo.title, 
                                        "completed": todo.completed, 
                                        "due_date": getDate(todo)}));
  }

  function todosForTitle() {
    let arrTodos;

    if (crntTitle === "All Todos") {
      arrTodos = todos;
    } else if (crntTitle === "Completed") {
      arrTodos = completedTodos();
    } else {
        if (crntLocation === "completed_items") {
          arrTodos = todosByDate(completedTodos())[crntTitle] || [];
        } else {
          arrTodos = todosByDate(todos)[crntTitle] || [];
        }
    }

    return arrTodos;
  }

  function todosByDate(arrTodos) {
    let unordered = {};
    let ordered = {};

    arrTodos.forEach(todo => {
      const date = getDate(todo);
      if (unordered[date]) {
        unordered[date].push(todo);
      } else {
        unordered[date] = [todo];
      }
    });
    
    Object.keys(unordered).forEach(key => ordered[key] = unordered[key]);

    return ordered;
  }

  function completedTodos() {
    return todos.filter(todo => todo.completed);
  }

  function sortByYear(arrTodos) {
    return arrTodos.sort((a, b) => {
      return (a.year === b.year) ? a.month - b.month : a.year - b.year;
    });
  }

  function buildMainContext() {
    crntTitle = crntTitle || "All Todos";
    crntLocation = crntLocation || "all";

    mainContext.current_section = {title: crntTitle, data: todosForTitle().length};
    mainContext.selected = selectedTodos();
  }

  function buildNavContext() {
    navContext.todos = todos;
    navContext.todos_by_date = todosByDate(sortByYear(todos));
    navContext.done = completedTodos();
    navContext.done_todos_by_date = todosByDate(sortByYear(completedTodos()));
  }

  function renderPage() {
    buildNavContext();
    buildMainContext();
    updateSidebar();
    updateMainPage();
  }

  function updateSidebar() {
    $("#sidebar").html(templates.nav_template(navContext));

    crntTitle = crntTitle || "All Todos";
    crntLocation = crntLocation || "all";

    $(`#${crntLocation}`).find(`[data-title="${crntTitle}"]`).addClass("active");
  }

  function updateMainPage() {
    $("#items").html(templates.main_template(mainContext));
  }

  function getDate(todo) {
    const month = todo.month;
    const year = todo.year;
    
    if (!month || !year) {
      return "No Due Date";
    } else {
      return `${month}/${year.slice(-2)}`;
    }
  }

  function findTodo(id) {
    return todos.find(todo => todo.id === +id);
  }
});