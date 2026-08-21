const sidebar = document.querySelector('#sidebar');
const overlay = document.querySelector('#overlay');
const toast = document.querySelector('#toast');
let toastTimer;

lucide.createIcons();

function showToast(message) {
  toast.querySelector('span').textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}

function closeMenu() {
  sidebar.classList.remove('open');
  overlay.classList.remove('show');
}

document.querySelector('#menuToggle').addEventListener('click', () => {
  sidebar.classList.add('open');
  overlay.classList.add('show');
});
overlay.addEventListener('click', closeMenu);

document.querySelectorAll('.nav-item[data-view]').forEach((item) => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach((navItem) => navItem.classList.remove('active'));
    item.classList.add('active');
    showToast(`${item.dataset.view} workspace selected`);
    closeMenu();
  });
});

document.querySelectorAll('[data-action]').forEach((button) => {
  button.addEventListener('click', () => showToast(`${button.dataset.action[0].toUpperCase()}${button.dataset.action.slice(1)} opened`));
});

document.querySelector('#newSession').addEventListener('click', () => showToast('New session draft created'));
document.querySelector('#calendarButton').addEventListener('click', () => showToast('Calendar view opened'));
document.querySelector('#briefButton').addEventListener('click', () => showToast('Full AI brief opened'));
document.querySelector('#searchButton').addEventListener('click', () => showToast('Search is ready for clients and notes'));

document.querySelector('#trendFilter').addEventListener('click', (event) => {
  const button = event.currentTarget;
  const options = ['Last 7 days', 'Last 30 days', 'Last 90 days'];
  const current = options.indexOf(button.childNodes[0].textContent.trim());
  const next = options[(current + 1) % options.length];
  button.childNodes[0].textContent = next + ' ';
  showToast(`Showing ${next.toLowerCase()}`);
});
