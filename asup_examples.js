const ASUP_EXAMPLES = {
  nfs_iscsi: {
    title: "ONTAP 9.12.1 (NFS & iSCSI Data Center)",
    content: `::> version
NetApp Release 9.12.1P4: Thu Jun 15 12:03:10 UTC 2023

::> network interface show
            Logical    Status     Network            Current       Current Is
Vserver     Interface  Admin/Oper Address/Mask       Node          Port    Home
----------- ---------- ---------- ------------------ ------------- ------- ----
cluster1
            cluster_mgmt up/up    192.168.10.50/24   cluster1-01   e0M     true
            node1_mgmt   up/up    192.168.10.51/24   cluster1-01   e0M     true
            node2_mgmt   up/up    192.168.10.52/24   cluster1-02   e0M     true
svm_prod
            lif_mgmt_1   up/up    192.168.20.10/24   cluster1-01   e0d     true
            lif_nfs_1    up/up    192.168.20.21/24   cluster1-01   e0a     true
            lif_iscsi_1  up/up    192.168.30.21/24   cluster1-01   e0b     true
            lif_iscsi_2  up/up    192.168.30.22/24   cluster1-02   e0b     true

::> vserver show
Vserver           Type     Subtype    Admin      Operational
-----------       -------  ---------  ---------  -----------
cluster1          admin    -          -          -
svm_prod          data     default    running    running

::> storage aggregate show
Aggregate     Size Available Used% State   #Vols  Nodes            RAID Status
--------- -------- --------- ----- ------- ------ ---------------- ------------
aggr_nvme_1 2.45TB  850.4GB   65%   online       6 node1            raid_dp, normal
aggr_ssd_2  4.80TB  1.20TB    75%   online       4 node2            raid_dp, normal

::> volume show
Vserver   Volume       Aggregate    State      Area       Size  Percent Used
--------- ------------ ------------ ---------- ---------- ----- ------------
svm_prod  vol_esxi_datastore aggr_nvme_1 online volume 800GB 45%
svm_prod  vol_nfs_shared aggr_ssd_2  online     volume     1.50TB 60%
svm_prod  vol_smb_users  aggr_ssd_2  online     volume     500GB 20%

::> igroup show
Vserver   Igroup       Protocol Port Type  Initiators
--------- ------------ -------- ---------  ------------------------------------
svm_prod  ig_esxi_prod  iscsi    vmware    iqn.1998-01.com.vmware:esxi-host01
                                           iqn.1998-01.com.vmware:esxi-host02
svm_prod  ig_linux_db   iscsi    linux     iqn.1994-05.com.redhat:db-server-01
`
  },
  fc_san: {
    title: "ONTAP 9.10.1 (Fibre Channel SAN)",
    content: `::> version
NetApp Release 9.10.1P8: Tue Oct 25 15:44:12 UTC 2022

::> network interface show
            Logical    Status     Network            Current       Current Is
Vserver     Interface  Admin/Oper Address/Mask       Node          Port    Home
----------- ---------- ---------- ------------------ ------------- ------- ----
cluster2
            cluster_mgmt up/up    10.50.4.15/24      cluster2-01   e0M     true
svm_fc_db
            lif_mgmt_1   up/up    10.50.6.100/24     cluster2-01   e0d     true
            lif_fc_1a    up/up    20:01:00:a0:98:34:cf:11 cluster2-01 e0a true
            lif_fc_1b    up/up    20:02:00:a0:98:34:cf:12 cluster2-01 e0b true

::> vserver show
Vserver           Type     Subtype    Admin      Operational
-----------       -------  ---------  ---------  -----------
cluster2          admin    -          -          -
svm_fc_db         data     default    running    running

::> storage aggregate show
Aggregate     Size Available Used% State   #Vols  Nodes            RAID Status
--------- -------- --------- ----- ------- ------ ---------------- ------------
aggr_fc_1  8.50TB  3.20TB    62%   online       2 node1            raid_dp, normal

::> volume show
Vserver   Volume       Aggregate    State      Area       Size  Percent Used
--------- ------------ ------------ ---------- ---------- ----- ------------
svm_fc_db vol_oracle   aggr_fc_1    online     volume     2.00TB 70%
svm_fc_db vol_mssql    aggr_fc_1    online     volume     1.00TB 40%

::> igroup show
Vserver   Igroup       Protocol Port Type  Initiators
--------- ------------ -------- ---------  ------------------------------------
svm_fc_db ig_oracle_nodes fcp    linux     21:00:00:24:ff:89:12:0a
                                           21:00:00:24:ff:89:12:0b
svm_fc_db ig_windows_sql fcp     windows   21:00:00:13:97:ab:cd:e0
                                           21:00:00:13:97:ab:cd:e1
`
  },
  nvme_s3: {
    title: "ONTAP 9.13.1 (NVMe/TCP & Native S3 Object)",
    content: `::> version
NetApp Release 9.13.1P1: Wed May 03 08:30:14 UTC 2023

::> network interface show
            Logical    Status     Network            Current       Current Is
Vserver     Interface  Admin/Oper Address/Mask       Node          Port    Home
----------- ---------- ---------- ------------------ ------------- ------- ----
cluster_nvme
            cluster_mgmt up/up    172.16.5.80/22     nvme-node-01  e0M     true
svm_nvme
            lif_mgmt_1   up/up    172.16.6.10/22     nvme-node-01  e0d     true
            lif_nvme_1   up/up    172.16.8.21/22     nvme-node-01  e0f     true
            lif_nvme_2   up/up    172.16.8.22/22     nvme-node-02  e0f     true
            lif_s3_1     up/up    172.16.9.50/22     nvme-node-01  e0e     true

::> vserver show
Vserver           Type     Subtype    Admin      Operational
-----------       -------  ---------  ---------  -----------
cluster_nvme      admin    -          -          -
svm_nvme          data     default    running    running

::> storage aggregate show
Aggregate     Size Available Used% State   #Vols  Nodes            RAID Status
--------- -------- --------- ----- ------- ------ ---------------- ------------
aggr_nvme_prod 15.0TB 8.40TB  44%   online       3 nvme-node-01     raid_tec, normal

::> volume show
Vserver   Volume       Aggregate    State      Area       Size  Percent Used
--------- ------------ ------------ ---------- ---------- ----- ------------
svm_nvme  vol_nvme_db1 aggr_nvme_prod online  volume     5.00TB 30%
svm_nvme  vol_s3_bucket aggr_nvme_prod online volume     2.50TB 10%

::> igroup show
Vserver   Igroup       Protocol Port Type  Initiators
--------- ------------ -------- ---------  ------------------------------------
svm_nvme  ig_nvme_kube  nvme     linux     nqn.2014-08.org.nvmexpress:uuid:e00305b0-e34d-11ed-b5ea-005056b3e210
                                           nqn.2014-08.org.nvmexpress:uuid:e00305b0-e34d-11ed-b5ea-005056b3e211
`
  }
};
