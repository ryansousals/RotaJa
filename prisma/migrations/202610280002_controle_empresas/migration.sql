ALTER TABLE "emp_empresas" ADD COLUMN "dt_exc" TIMESTAMPTZ(3);
CREATE TABLE "cfg_sistema" ("id_cfg" INTEGER PRIMARY KEY DEFAULT 1 CHECK ("id_cfg" = 1), "st_emp_lig" BOOLEAN NOT NULL DEFAULT true, "versao" INTEGER NOT NULL DEFAULT 0, "dt_alt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "id_usr_alt" UUID);
INSERT INTO "cfg_sistema" ("id_cfg") VALUES (1);
