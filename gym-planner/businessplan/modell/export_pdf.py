"""Öffnet die DOCX in LibreOffice (UNO), aktualisiert Inhaltsverzeichnis/Felder, speichert DOCX (mit Verzeichnis) und exportiert PDF.
Aufruf: python3 export_pdf.py in.docx out.docx out.pdf
"""
from __future__ import annotations

import os
import subprocess
import sys
import tempfile
import time

import uno  # type: ignore
from com.sun.star.beans import PropertyValue  # type: ignore


def prop(name, value):
    p = PropertyValue()
    p.Name = name
    p.Value = value
    return p


def main(src: str, out_docx: str, out_pdf: str) -> None:
    profile = tempfile.mkdtemp(prefix='lo_uno_')
    port = 2002
    env = dict(os.environ, SAL_USE_VCLPLUGIN='svp')
    proc = subprocess.Popen(['soffice', f'-env:UserInstallation=file://{profile}', '--headless', '--norestore', '--nologo', f'--accept=socket,host=127.0.0.1,port={port};urp;'], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        local = uno.getComponentContext()
        resolver = local.ServiceManager.createInstanceWithContext('com.sun.star.bridge.UnoUrlResolver', local)
        ctx = None
        for _ in range(60):
            try:
                ctx = resolver.resolve(f'uno:socket,host=127.0.0.1,port={port};urp;StarOffice.ComponentContext')
                break
            except Exception:
                time.sleep(1)
        if ctx is None:
            raise SystemExit('LibreOffice nicht erreichbar')
        desktop = ctx.ServiceManager.createInstanceWithContext('com.sun.star.frame.Desktop', ctx)
        doc = desktop.loadComponentFromURL(uno.systemPathToFileUrl(os.path.abspath(src)), '_blank', 0, (prop('Hidden', True),))
        # Felder und Verzeichnisse zweimal aktualisieren (Seitenzahlen ändern sich durch das Verzeichnis selbst)
        for _ in range(2):
            idx = doc.getDocumentIndexes()
            for i in range(idx.getCount()):
                idx.getByIndex(i).update()
            doc.getTextFields().refresh()
            try:
                doc.refresh()
            except Exception:
                pass
        doc.storeToURL(uno.systemPathToFileUrl(os.path.abspath(out_docx)), (prop('FilterName', 'MS Word 2007 XML'),))
        doc.storeToURL(uno.systemPathToFileUrl(os.path.abspath(out_pdf)), (prop('FilterName', 'writer_pdf_Export'),))
        pages = doc.getCurrentController().getPropertyValue('PageCount') if hasattr(doc.getCurrentController(), 'getPropertyValue') else None
        try:
            pages = doc.CurrentController.PageCount
        except Exception:
            pass
        doc.close(True)
        print('PDF geschrieben', out_pdf, 'Seiten', pages)
    finally:
        try:
            desktop.terminate()
        except Exception:
            pass
        proc.terminate()
        try:
            proc.wait(timeout=20)
        except Exception:
            proc.kill()


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], sys.argv[3])
