import { ajaxJSON } from './common.js';


$(function(){
$('#btnSignup').on('click', function(){
const f = new FormData(document.getElementById('formSignup'));
if(f.get('password') !== f.get('password2')) return alert('Passwörter stimmen nicht überein');
const body = { email: f.get('email'), password: f.get('password') };
ajaxJSON('/auth/register', 'POST', body)
.done(() => { alert('Registrierung erfolgreich. Bitte einloggen.'); location.href = '../logon/Logon.html'; })
.fail(x => alert(x.responseJSON?.message || 'Registrierung fehlgeschlagen'));
});
});