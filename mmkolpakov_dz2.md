# Домашнее Задание №2: Построение системы с учетом наблюдаемости (Observability)

В этом документе описано решение по настройке мониторинга для HA-кластера PostgreSQL и API-сервиса, развернутых в ДЗ №1. Решение выполнено в концепции **Infrastructure as Code (IaC)** с использованием Ansible.

## 1. Архитектура решения

Учитывая сетевые ограничения (отсутствие прямого доступа к ВМ, NAT), система мониторинга разделена на два уровня:

### 1.1. Внутренний контур (Infrastructure Monitoring)
Развернут на узле-балансировщике (`balancer`), который выступает сервером мониторинга.
*   **Prometheus (v3.8.0):** Сбор метрик со всех ВМ и сервисов. Конфигурация генерируется динамически на основе инвентаря Ansible.
*   **Alertmanager (v0.29.0):** Управление алертами. Принимает уведомления от Prometheus.
*   **Grafana (v12.3.0):** Локальная визуализация метрик инфраструктуры и БД.
*   **Blackbox Exporter (v0.27.0):** Мониторинг доступности API через Ingress.

### 1.2. Внешний контур (K8s Ingress Monitoring)
*   **Курсовая Grafana:** Используется для визуализации "Золотых сигналов" (Golden Signals) на основе метрик Ingress-контроллера Kubernetes, так как доступ к ним возможен только изнутри кластера K8s.

### 1.3. Агенты сбора метрик (Exporters)
*   **Node Exporter (v1.10.2):** На всех узлах кластера (CPU, RAM, Disk, Network).
*   **Postgres Exporter (v0.18.1):** На узлах СУБД (`bd1`, `bd2`). Для доступа создан специальный пользователь с ролью `pg_monitor`.
*   **Patroni & Etcd:** Скрейпинг нативных метрик по протоколу HTTPS (порты 8008 и 2379).

---

## 2. Детали реализации

### 2.1. Ansible
*   В `inventory.yml` добавлена группа `monitoring_server`.
*   В `group_vars/all.yml` определены версии компонентов и учетные данные пользователя мониторинга (`postgres_exporter`).
*   Написаны роли для каждого компонента: `prometheus`, `alertmanager`, `grafana`, `node_exporter`, `postgres_exporter`, `blackbox_exporter`.
 *   Используется паттерн "Download Locally", чтобы избежать проблем с доступом в интернет с серверов.
 *   В конфигах учтены особенности работы с SSL (Patroni) и заголовками Host (Ingress).

### 2.2. Алертинг (Пункт 6)
В Prometheus загружены правила (`alert.rules.yml`) для отслеживания критических метрик:
*   **HighRequestLatency:** Высокая задержка ответов API.
*   **HighErrorRate:** Высокий процент 5xx ошибок.
*   **HostHighCpuLoad:** Загрузка CPU > 80%.
*   **PostgresDown:** Недоступность экземпляра PostgreSQL.

---

## 3. Инструкция по развертыванию

### Шаг 1: Подготовка БД
Создание пользователя `postgres_exporter` и настройка `pg_hba.conf`.
```bash
ansible-playbook -i inventory.yml playbooks/config_pgcluster.yml -f 2
```

### Шаг 2: Установка стека мониторинга
Установка и настройка Prometheus, Alertmanager, Grafana и всех экспортеров.
```bash
ansible-playbook -i inventory.yml playbooks/deploy_monitoring.yml -f 2
```

### Шаг 3: Автоматическая диагностика
Запуск скрипта проверки здоровья компонентов:
```bash
./check_hw2.sh
```
*Ожидаемый результат:* Все таргеты в статусе `UP`, порт 3000 (Grafana) и 9093 (Alertmanager) слушаются.

---

## 4. Визуализация (Сдача ДЗ)

### 4.1. Метрики инфраструктуры (Локальная Grafana)
Доступ осуществляется через SSH-туннель:
```bash
ssh -L 3000:127.0.0.1:3000 -p 27022 -i ~/.ssh/mipt-wsl22 mmkolpakov@77.105.182.79
```
URL: http://localhost:3000 (admin/admin)
Дашборды:
*   **PostgreSQL Database** (ID 9628)
*   **Node Exporter Full** (ID 1860)

### 4.2. Метрики API (Курсовая Grafana)
URL: http://grafana.training.course.sre.mts (Login: `student7`)
Дашборд: **"Student-7 mmkolpakov API Monitoring"**.
Реализованы 4 золотых сигнала на базе метрик Ingress-контроллера:
1.  **Traffic:** RPS к API.
2.  **Latency:** 99-й перцентиль времени ответа.
3.  **Errors:** Количество 5xx ошибок.
4.  **Saturation:** Распределение кодов ответа (Response Codes).

---

## 5. Удаление (Cleanup)
Для удаления компонентов мониторинга (без влияния на работу БД) используется плейбук:
```bash
ansible-playbook -i inventory.yml playbooks/remove_monitoring.yml -f 2
```
