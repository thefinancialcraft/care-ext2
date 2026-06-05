const icon = document.getElementById("toggleIcon");
const tableBox = document.querySelector(".div-tabel");

icon.addEventListener("click", () => {
  tableBox.classList.toggle("collapsed");
  icon.classList.toggle("rotated");
});
