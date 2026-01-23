// Supabase Configuration
(function () {
    var URL = 'https://pugtndruuelblwvpqdog.supabase.co';
    var KEY = 'sb_publishable_T1Mn2K9xBnOZUGrj4PbuhQ_mggaPTH2';

    if (!window.sb) {
        window.sb = window.supabase.createClient(URL, KEY);
    }
})();

// Alias for backwards compatibility if needed, using 'var' to prevent redeclaration errors
var supabase = window.sb;
