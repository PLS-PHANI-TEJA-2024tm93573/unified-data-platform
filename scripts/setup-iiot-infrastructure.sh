#!/usr/bin/env bash
set -Eeuo pipefail

# Creates GitOps manifests for Core NATS, Node-RED, and PostgreSQL in industrial-iot.
# Creates the PostgreSQL Secret directly in the cluster so credentials are
# not committed to Git. Flux manages the workloads; this script does not
# install or upgrade Helm charts.

ROOT_DIR="${1:-}"
if [[ -z "$ROOT_DIR" ]]; then
  ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || true)"
fi

if [[ -z "$ROOT_DIR" || ! -d "$ROOT_DIR/.git" ]]; then
  echo "ERROR: Run inside your Git repository or pass its root directory."
  echo "Usage: $0 [repository-root]"
  exit 1
fi

ROOT_DIR="$(cd "$ROOT_DIR" && pwd)"
CLUSTER_DIR="$ROOT_DIR/clusters/k3s"
INFRA_DIR="$CLUSTER_DIR/infrastructure"

for cmd in kubectl; do
  command -v "$cmd" >/dev/null 2>&1 || {
    echo "ERROR: $cmd is required."
    exit 1
  }
done

[[ -f "$CLUSTER_DIR/kustomization.yaml" ]] || {
  echo "ERROR: Missing $CLUSTER_DIR/kustomization.yaml"
  exit 1
}

kubectl get namespace industrial-iot >/dev/null 2>&1 || {
  echo "ERROR: Namespace industrial-iot does not exist yet."
  echo "Commit/push the namespace manifest and wait for Flux, or create it before running this script."
  exit 1
}

kubectl get storageclass local-path >/dev/null 2>&1 || {
  echo "ERROR: StorageClass 'local-path' was not found."
  echo "Check with: kubectl get storageclass"
  exit 1
}

mkdir -p "$INFRA_DIR/nats" "$INFRA_DIR/node-red" "$INFRA_DIR/postgres"

cat > "$INFRA_DIR/kustomization.yaml" <<'YAML'
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - nats
  - node-red
  - postgres
YAML

cat > "$INFRA_DIR/nats/kustomization.yaml" <<'YAML'
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - deployment.yaml
  - service.yaml
YAML

cat > "$INFRA_DIR/nats/deployment.yaml" <<'YAML'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nats
  namespace: industrial-iot
  labels:
    app.kubernetes.io/name: nats
    app.kubernetes.io/component: messaging
spec:
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: nats
  template:
    metadata:
      labels:
        app.kubernetes.io/name: nats
        app.kubernetes.io/component: messaging
    spec:
      containers:
        - name: nats
          image: nats:2.11-alpine
          imagePullPolicy: IfNotPresent
          args:
            - "--http_port"
            - "8222"
          ports:
            - name: client
              containerPort: 4222
              protocol: TCP
            - name: monitoring
              containerPort: 8222
              protocol: TCP
          readinessProbe:
            tcpSocket:
              port: client
            initialDelaySeconds: 3
            periodSeconds: 5
          livenessProbe:
            tcpSocket:
              port: client
            initialDelaySeconds: 10
            periodSeconds: 10
          resources:
            requests:
              cpu: 50m
              memory: 64Mi
            limits:
              cpu: 500m
              memory: 256Mi
YAML

cat > "$INFRA_DIR/nats/service.yaml" <<'YAML'
apiVersion: v1
kind: Service
metadata:
  name: nats
  namespace: industrial-iot
  labels:
    app.kubernetes.io/name: nats
spec:
  type: ClusterIP
  selector:
    app.kubernetes.io/name: nats
  ports:
    - name: client
      port: 4222
      targetPort: client
      protocol: TCP
    - name: monitoring
      port: 8222
      targetPort: monitoring
      protocol: TCP
YAML

cat > "$INFRA_DIR/node-red/kustomization.yaml" <<'YAML'
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - deployment.yaml
  - service.yaml
  - pvc.yaml
YAML

cat > "$INFRA_DIR/node-red/deployment.yaml" <<'YAML'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: node-red
  namespace: industrial-iot
  labels:
    app.kubernetes.io/name: node-red
    app.kubernetes.io/component: flow-editor
spec:
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: node-red
  template:
    metadata:
      labels:
        app.kubernetes.io/name: node-red
        app.kubernetes.io/component: flow-editor
    spec:
      containers:
        - name: node-red
          image: nodered/node-red:latest
          imagePullPolicy: IfNotPresent
          ports:
            - name: http
              containerPort: 1880
              protocol: TCP
          startupProbe:
            httpGet:
              path: /
              port: http
            periodSeconds: 5
            failureThreshold: 30
          readinessProbe:
            httpGet:
              path: /
              port: http
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /
              port: http
            periodSeconds: 20
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 512Mi
          volumeMounts:
            - name: node-red-data
              mountPath: /data
      volumes:
        - name: node-red-data
          persistentVolumeClaim:
            claimName: node-red-data
YAML

cat > "$INFRA_DIR/node-red/service.yaml" <<'YAML'
apiVersion: v1
kind: Service
metadata:
  name: node-red
  namespace: industrial-iot
  labels:
    app.kubernetes.io/name: node-red
spec:
  type: NodePort
  selector:
    app.kubernetes.io/name: node-red
  ports:
    - name: http
      port: 1880
      targetPort: http
      nodePort: 31880
      protocol: TCP
YAML

cat > "$INFRA_DIR/node-red/pvc.yaml" <<'YAML'
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: node-red-data
  namespace: industrial-iot
  labels:
    app.kubernetes.io/name: node-red
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: local-path
  resources:
    requests:
      storage: 1Gi
YAML

cat > "$INFRA_DIR/postgres/kustomization.yaml" <<'YAML'
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - service.yaml
  - statefulset.yaml
YAML

cat > "$INFRA_DIR/postgres/service.yaml" <<'YAML'
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: industrial-iot
  labels:
    app.kubernetes.io/name: postgres
spec:
  type: ClusterIP
  selector:
    app.kubernetes.io/name: postgres
  ports:
    - name: postgres
      port: 5432
      targetPort: postgres
      protocol: TCP
---
apiVersion: v1
kind: Service
metadata:
  name: postgres-headless
  namespace: industrial-iot
  labels:
    app.kubernetes.io/name: postgres
spec:
  clusterIP: None
  selector:
    app.kubernetes.io/name: postgres
  ports:
    - name: postgres
      port: 5432
      targetPort: postgres
      protocol: TCP
YAML

cat > "$INFRA_DIR/postgres/statefulset.yaml" <<'YAML'
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
  namespace: industrial-iot
  labels:
    app.kubernetes.io/name: postgres
    app.kubernetes.io/component: database
spec:
  serviceName: postgres-headless
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: postgres
  template:
    metadata:
      labels:
        app.kubernetes.io/name: postgres
        app.kubernetes.io/component: database
    spec:
      terminationGracePeriodSeconds: 30
      containers:
        - name: postgres
          image: postgres:16-alpine
          imagePullPolicy: IfNotPresent
          ports:
            - name: postgres
              containerPort: 5432
              protocol: TCP
          env:
            - name: POSTGRES_DB
              valueFrom:
                secretKeyRef:
                  name: postgres-credentials
                  key: database
            - name: POSTGRES_USER
              valueFrom:
                secretKeyRef:
                  name: postgres-credentials
                  key: username
            - name: POSTGRES_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: postgres-credentials
                  key: password
            - name: PGDATA
              value: /var/lib/postgresql/data/pgdata
          readinessProbe:
            exec:
              command:
                - sh
                - -c
                - pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"
            initialDelaySeconds: 10
            periodSeconds: 5
            timeoutSeconds: 3
            failureThreshold: 6
          livenessProbe:
            exec:
              command:
                - sh
                - -c
                - pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"
            initialDelaySeconds: 30
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 6
          resources:
            requests:
              cpu: 100m
              memory: 256Mi
            limits:
              cpu: "1"
              memory: 1Gi
          volumeMounts:
            - name: postgres-data
              mountPath: /var/lib/postgresql/data
  volumeClaimTemplates:
    - metadata:
        name: postgres-data
      spec:
        accessModes:
          - ReadWriteOnce
        storageClassName: local-path
        resources:
          requests:
            storage: 5Gi
YAML

if kubectl get secret postgres-credentials -n industrial-iot >/dev/null 2>&1; then
  echo "Kubernetes Secret postgres-credentials already exists; leaving it unchanged."
  echo "This avoids changing the Secret without updating an initialized PostgreSQL database."
else
  echo "Creating PostgreSQL credentials as a Kubernetes Secret."
  echo "These credentials will NOT be written into the Git repository."
  read -r -p "PostgreSQL username [iiot_app]: " PG_USER
  PG_USER="${PG_USER:-iiot_app}"
  read -r -p "PostgreSQL database [industrial_iot]: " PG_DB
  PG_DB="${PG_DB:-industrial_iot}"
  read -r -s -p "Choose a PostgreSQL password (input hidden): " PG_PASSWORD
  echo
  if [[ -z "$PG_PASSWORD" ]]; then
    echo "ERROR: Password cannot be empty."
    exit 1
  fi

  kubectl create secret generic postgres-credentials \
    --namespace industrial-iot \
    --from-literal=username="$PG_USER" \
    --from-literal=password="$PG_PASSWORD" \
    --from-literal=database="$PG_DB" \
    --dry-run=client -o yaml | kubectl apply -f -

  unset PG_PASSWORD
fi

echo
echo "Validating infrastructure manifests with Kustomize..."
kubectl kustomize "$INFRA_DIR" >/dev/null
echo "Kustomize build: OK"

echo
echo "Created files:"
find "$INFRA_DIR" -maxdepth 3 -type f -print | sort

echo
echo "Review and commit the manifests:"
echo "  git status --short"
echo "  git diff -- clusters/k3s/infrastructure"
echo "  git add clusters/k3s/infrastructure"
echo "  git commit -m 'feat: add IIoT infrastructure manifests'"
echo "  git push origin main"
echo
echo "Then verify Flux and workloads:"
echo "  flux get kustomizations -A"
echo "  kubectl get pods -n industrial-iot"
echo "  kubectl get pvc -n industrial-iot"
echo
echo "In-cluster connection endpoints:"
echo "  NATS:      nats://nats.industrial-iot.svc.cluster.local:4222"
echo "  Node-RED:  http://<k3s-node-ip>:31880 (NodePort; also node-red.industrial-iot.svc:1880 in-cluster)"
echo "  PostgreSQL: postgres.industrial-iot.svc.cluster.local:5432"
echo
echo "Note: PostgreSQL PVC uses k3s local-path storage on this single node."
echo "Back up important database data separately; this is not HA storage."
