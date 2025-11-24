function doGet(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  // --- CONFIGURATION ---
  var SHEET_NAME = "Films"; 
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.getSheets()[0];
  
  var action = e.parameter.action;
  
  // Mapping des colonnes
  var COLUMNS = {
    'LASERDISC': 1, 
    'DVD': 2,       
    'Blu-Ray': 3,   
    'à acheter': 4  
  };
  
  var HEADERS = ['LASERDISC', 'DVD', 'Blu-Ray', 'à acheter'];
  var result = { status: 'error', message: 'Action inconnue' };
  
  try {
    
    // --- RECHERCHE ---
    if (action === "search") {
      var query = (e.parameter.query || "").toLowerCase();
      var lastRow = sheet.getLastRow();
      var found = [];
      
      if (lastRow > 1) {
        var data = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
        for (var i = 0; i < data.length; i++) {
          for (var col = 0; col < 4; col++) {
             var cellVal = String(data[i][col]).trim();
             if (cellVal && cellVal.toLowerCase().indexOf(query) > -1) {
               found.push({ title: cellVal, support: HEADERS[col] });
             }
          }
        }
      }
      result = { status: 'success', data: found };
    
    // --- TOUT RECUPERER ---
    } else if (action === "getAll") {
      var lastRow = sheet.getLastRow();
      var allMovies = [];
      if (lastRow > 1) {
        var data = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
        for (var i = 0; i < data.length; i++) {
          for (var col = 0; col < 4; col++) {
             var cellVal = String(data[i][col]).trim();
             if (cellVal) allMovies.push({ title: cellVal, support: HEADERS[col] });
          }
        }
      }
      result = { status: 'success', data: allMovies };

    // --- AJOUTER ---
    } else if (action === "add") {
      var title = (e.parameter.title || "").trim();
      var support = e.parameter.support;
      var colIdx = COLUMNS[support];
      
      if (colIdx && title) {
        var lastRow = sheet.getLastRow();
        var targetRow = lastRow + 1;
        
        // Chercher le premier trou vide dans la colonne pour éviter les trous
        if (lastRow >= 2) {
           var range = sheet.getRange(2, colIdx, lastRow - 1, 1);
           var values = range.getValues();
           for (var i = 0; i < values.length; i++) {
             if (values[i][0] === "") {
               targetRow = i + 2; // +2 car index 0 = ligne 2
               break;
             }
           }
        }
        
        sheet.getRange(targetRow, colIdx).setValue(title);
        result = { status: 'success', message: 'Ajouté avec succès' };
      } else {
        result = { status: 'error', message: 'Données invalides' };
      }

    // --- SUPPRIMER (COMPATIBLE TABLEAUX) ---
    } else if (action === "delete") {
      var title = (e.parameter.title || "").trim();
      var support = e.parameter.support;
      var colIdx = COLUMNS[support];
      
      if (colIdx && title) {
        var lastRow = sheet.getLastRow();
        // 1. Lire toute la colonne
        // On prend max(lastRow - 1, 1) pour ne pas planter si la feuille est vide
        var range = sheet.getRange(2, colIdx, Math.max(lastRow - 1, 1), 1);
        var values = range.getValues();
        
        var newValues = [];
        var found = false;
        
        // 2. Reconstruire la liste sans l'élément à supprimer
        for (var i = 0; i < values.length; i++) {
          var val = String(values[i][0]).trim();
          
          // On supprime seulement la première occurrence trouvée
          if (val === title && !found) {
            found = true; 
          } else if (val !== "") {
            // On garde les autres valeurs non-vides
            newValues.push([val]);
          }
        }
        
        if (found) {
          // 3. Vider la colonne (safe pour les Tableaux)
          range.clearContent();
          
          // 4. Réécrire les valeurs "compactées" (remontées vers le haut)
          if (newValues.length > 0) {
            sheet.getRange(2, colIdx, newValues.length, 1).setValues(newValues);
          }
          result = { status: 'success', message: 'Supprimé' };
        } else {
          result = { status: 'error', message: 'Film non trouvé' };
        }
      } else {
        result = { status: 'error', message: 'Support invalide' };
      }

    // --- MODIFIER ---
    } else if (action === "edit") {
      var oldTitle = (e.parameter.oldTitle || "").trim();
      var newTitle = (e.parameter.newTitle || "").trim();
      var support = e.parameter.support;
      var colIdx = COLUMNS[support];
      
      if (colIdx && oldTitle && newTitle) {
        var lastRow = sheet.getLastRow();
        var range = sheet.getRange(2, colIdx, Math.max(lastRow - 1, 1), 1);
        var values = range.getValues();
        var updated = false;
        
        for (var i = 0; i < values.length; i++) {
          if (String(values[i][0]).trim() === oldTitle) {
            sheet.getRange(i + 2, colIdx).setValue(newTitle);
            updated = true;
            break; 
          }
        }
        
        if (updated) {
           result = { status: 'success', message: 'Modifié' };
        } else {
           result = { status: 'error', message: 'Film original non trouvé' };
        }
      } else {
        result = { status: 'error', message: 'Support invalide' };
      }
    }

  } catch (err) {
    result = { status: 'error', message: err.toString() };
  }
  
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}
