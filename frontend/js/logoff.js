import { clearAuth } from './common.js';


$(function(){
clearAuth();
// kurze Info und zurück zum Logon
$('#message').text('Du wurdest abgemeldet.');
setTimeout(() => { window.location.href = '../logon/Logon.html'; }, 800);
});