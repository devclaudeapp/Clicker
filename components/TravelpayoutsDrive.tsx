import Script from "next/script";

/** TEMPORAIRE : vérification Travelpayouts. À retirer ensuite (ce fichier et son appel dans app/layout.tsx). */
export function TravelpayoutsDrive() {
  return (
    <Script id="travelpayouts-drive" strategy="beforeInteractive" data-cmp-ab="2">
      {`(function(){var s=document.createElement("script");s.async=1;s.setAttribute("data-cmp-ab","2");s.src="https://emrldtp.cc/NTgxMTMz.js?t=581133";document.head.appendChild(s);})();`}
    </Script>
  );
}