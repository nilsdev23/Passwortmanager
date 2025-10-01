import { ajaxJSON, setAuth } from './common.js';


const state = { tempLogin: null };


$(function(){
// Falls schon eingeloggt → auf Settings oder App-Startseite schicken
try { const s = JSON.parse(localStorage.getItem('pm_auth')); if(s?.token){ location.href = '../settings/settings.html'; return; } } catch(e){}


$('#formLogin').on('submit', function(e){
e.preventDefault();
const body = Object.fromEntries(new FormData(this).entries());
ajaxJSON('/auth/login', 'POST', body)
.done(res => {
if(res.requiresTotp){
state.tempLogin = res.tempLogin;
$('#totpStep').removeClass('hidden');
} else {
setAuth(res.accessToken, res.user);
location.href = '../settings/settings.html';
}
})
.fail(x => alert(x.responseJSON?.message || 'Login fehlgeschlagen'));
});


$('#formTotp').on('submit', function(e){
e.preventDefault();
const code = new FormData(this).get('code');
ajaxJSON('/auth/totp/verify', 'POST', { code, tempLogin: state.tempLogin })
.done(res => { setAuth(res.accessToken, res.user); location.href = '../settings/settings.html'; })
.fail(() => alert('TOTP ungültig'));
});
});